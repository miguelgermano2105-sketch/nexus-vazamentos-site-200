import express from 'express';
import rateLimit from 'express-rate-limit';
import { all, get, run, nowIso, getSettings } from '../db.js';
import {
  requireAuth,
  isStaff,
  publicUser,
  openConnection,
  closeConnection,
  onlineUserIds,
  touchPresence,
} from '../auth.js';
import { HttpError, badRequest, str, int, notFound, forbidden, containsUnsafeLink, countLinks } from '../util.js';
import { addClient, broadcast } from '../realtime.js';

const router = express.Router();

const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : req.ip),
  message: { error: 'Você está enviando mensagens rápido demais. Aguarde um instante.' },
});

const MESSAGE_SELECT = `
  SELECT m.id, m.body, m.created_at, m.reply_to_id, m.deleted_at,
         u.id AS author_id, u.display_name AS author_name, u.username AS author_username,
         u.avatar AS author_avatar, u.role AS author_role,
         r.body AS reply_body, r.deleted_at AS reply_deleted_at,
         ru.display_name AS reply_author
  FROM community_messages m
  JOIN users u ON u.id = m.user_id
  LEFT JOIN community_messages r ON r.id = m.reply_to_id
  LEFT JOIN users ru ON ru.id = r.user_id
`;

function shape(row) {
  return {
    id: row.id,
    body: row.deleted_at ? null : row.body,
    createdAt: row.created_at,
    deleted: !!row.deleted_at,
    replyTo: row.reply_to_id
      ? {
          id: row.reply_to_id,
          author: row.reply_author || 'membro',
          body: row.reply_deleted_at ? null : (row.reply_body || '').slice(0, 160),
        }
      : null,
    author: {
      id: row.author_id,
      name: row.author_name,
      username: row.author_username,
      avatar: row.author_avatar || null,
      role: row.author_role,
    },
  };
}

function activeMute(userId) {
  return get('SELECT * FROM mutes WHERE user_id = ? AND muted_until > ? ORDER BY muted_until DESC LIMIT 1', [
    userId,
    nowIso(),
  ]);
}

router.get('/rules', (_req, res) => {
  const settings = getSettings();
  res.json({
    rules: settings.community_rules || '',
    enabled: settings.community_enabled === '1',
  });
});

router.get('/messages', (req, res) => {
  const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 40));
  const before = req.query.before ? String(req.query.before) : null;
  const rows = before
    ? all(`${MESSAGE_SELECT} WHERE m.created_at < ? ORDER BY m.created_at DESC LIMIT ?`, [before, limit])
    : all(`${MESSAGE_SELECT} ORDER BY m.created_at DESC LIMIT ?`, [limit]);
  res.json({ messages: rows.reverse().map(shape) });
});

router.get('/online', (req, res) => {
  const ids = onlineUserIds();
  if (!ids.length) return res.json({ online: [], total: 0, guests: 0 });
  const placeholders = ids.map(() => '?').join(',');
  const users = all(
    `SELECT id, display_name, username, avatar, role FROM users WHERE id IN (${placeholders}) AND status = 'active'`,
    ids,
  );
  res.json({
    online: users.map((u) => ({
      id: u.id,
      name: u.display_name,
      username: u.username,
      avatar: u.avatar || null,
      role: u.role,
    })),
    total: users.length,
    guests: 0,
  });
});

/** Canal em tempo real (Server-Sent Events). */
router.get('/stream', requireAuth, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`event: ready\ndata: ${JSON.stringify({ userId: req.user.id })}\n\n`);
  openConnection(req.user.id);
  const remove = addClient(res, req.user.id);
  broadcast('presence', { online: onlineUserIds().length });

  req.on('close', () => {
    remove();
    closeConnection(req.user.id);
    broadcast('presence', { online: onlineUserIds().length });
  });
});

router.post('/messages', requireAuth, sendLimiter, (req, res) => {
  const settings = getSettings();
  if (settings.community_enabled !== '1') {
    throw new HttpError(503, 'O chat da comunidade está temporariamente desativado pela administração.');
  }
  if (req.user.status !== 'active') throw forbidden('Sua conta não pode enviar mensagens.');

  const mute = activeMute(req.user.id);
  if (mute) {
    throw new HttpError(403, `Você está silenciado até ${new Date(mute.muted_until).toLocaleString('pt-BR')}.`);
  }

  const body = str(req.body.body, { min: 1, max: 800, field: 'mensagem' });
  if (countLinks(body) > 2) throw badRequest('Máximo de 2 links por mensagem.');
  if (containsUnsafeLink(body)) throw badRequest('Este link não é permitido na comunidade.');

  const recent = all(
    'SELECT body, created_at FROM community_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
    [req.user.id],
  );
  const tenSecondsAgo = Date.now() - 10_000;
  const burst = recent.filter((m) => new Date(m.created_at).getTime() > tenSecondsAgo);
  if (burst.length >= 5) throw new HttpError(429, 'Muitas mensagens consecutivas. Respire e tente novamente.');
  if (recent[0] && recent[0].body === body && Date.now() - new Date(recent[0].created_at).getTime() < 45_000) {
    throw badRequest('Mensagem repetida detectada. Evite spam.');
  }

  let replyToId = null;
  if (req.body.replyToId) {
    replyToId = int(req.body.replyToId, { min: 1, field: 'resposta' });
    if (!get('SELECT id FROM community_messages WHERE id = ?', [replyToId])) {
      throw notFound('A mensagem respondida não existe mais.');
    }
  }

  const createdAt = nowIso();
  const { lastInsertRowid } = run(
    'INSERT INTO community_messages (user_id, body, reply_to_id, created_at) VALUES (?, ?, ?, ?)',
    [req.user.id, body, replyToId, createdAt],
  );
  touchPresence(req.user.id);

  const row = get(`${MESSAGE_SELECT} WHERE m.id = ?`, [lastInsertRowid]);
  const message = shape(row);
  broadcast('message', message);
  res.status(201).json({ message });
});

router.delete('/messages/:id', requireAuth, (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'mensagem' });
  const row = get('SELECT * FROM community_messages WHERE id = ?', [id]);
  if (!row) throw notFound('Mensagem não encontrada.');
  if (row.user_id !== req.user.id && !isStaff(req.user)) {
    throw forbidden('Você só pode apagar suas próprias mensagens.');
  }
  run('UPDATE community_messages SET deleted_at = ?, deleted_by = ? WHERE id = ?', [nowIso(), req.user.id, id]);
  run(
    'INSERT INTO admin_logs (actor_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, 'community.message_deleted', 'message', String(id), 'Mensagem removida pelo autor ou equipe', nowIso()],
  );
  broadcast('message-deleted', { id });
  res.json({ ok: true });
});

router.post('/messages/:id/report', requireAuth, (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'mensagem' });
  const reason = str(req.body.reason, { min: 5, max: 400, field: 'motivo' });
  const row = get('SELECT id, user_id FROM community_messages WHERE id = ?', [id]);
  if (!row) throw notFound('Mensagem não encontrada.');
  if (row.user_id === req.user.id) throw badRequest('Você não pode denunciar sua própria mensagem.');
  const duplicate = get(
    "SELECT id FROM reports WHERE message_id = ? AND reporter_id = ? AND status = 'open'",
    [id, req.user.id],
  );
  if (duplicate) throw badRequest('Você já denunciou esta mensagem. A equipe irá analisar.');
  run(
    'INSERT INTO reports (message_id, reporter_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, req.user.id, reason, 'open', nowIso()],
  );
  res.status(201).json({ ok: true });
});

router.get('/blocks', requireAuth, (req, res) => {
  const rows = all(
    `SELECT b.blocked_user_id AS id, u.display_name, u.username FROM blocks b
     JOIN users u ON u.id = b.blocked_user_id WHERE b.user_id = ?`,
    [req.user.id],
  );
  res.json({ blocks: rows });
});

router.post('/blocks/:userId', requireAuth, (req, res) => {
  const target = int(req.params.userId, { min: 1, field: 'usuário' });
  if (target === req.user.id) throw badRequest('Você não pode bloquear a si mesmo.');
  if (!get('SELECT id FROM users WHERE id = ?', [target])) throw notFound('Usuário não encontrado.');
  const existing = get('SELECT 1 AS x FROM blocks WHERE user_id = ? AND blocked_user_id = ?', [req.user.id, target]);
  if (existing) {
    run('DELETE FROM blocks WHERE user_id = ? AND blocked_user_id = ?', [req.user.id, target]);
    return res.json({ blocked: false });
  }
  run('INSERT INTO blocks (user_id, blocked_user_id, created_at) VALUES (?, ?, ?)', [req.user.id, target, nowIso()]);
  res.json({ blocked: true });
});

/** Painel de moderação da comunidade. */
router.get('/moderation', requireAuth, (req, res) => {
  if (!isStaff(req.user)) throw forbidden('Área restrita à moderação.');
  const reports = all(
    `SELECT r.id, r.reason, r.status, r.created_at, r.message_id,
            m.body AS message_body, m.deleted_at,
            au.display_name AS author_name, au.id AS author_id,
            ru.display_name AS reporter_name
     FROM reports r
     LEFT JOIN community_messages m ON m.id = r.message_id
     LEFT JOIN users au ON au.id = m.user_id
     JOIN users ru ON ru.id = r.reporter_id
     ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 60`,
  );
  const mutes = all(
    `SELECT mu.id, mu.muted_until, mu.reason, mu.created_at, u.id AS user_id, u.display_name, u.username
     FROM mutes mu JOIN users u ON u.id = mu.user_id WHERE mu.muted_until > ? ORDER BY mu.muted_until DESC`,
    [nowIso()],
  );
  const online = onlineUserIds();
  res.json({
    reports,
    mutes,
    online: online.map((id) => {
      const u = get('SELECT id, display_name, username, role FROM users WHERE id = ?', [id]);
      return u ? { id: u.id, name: u.display_name, username: u.username, role: u.role } : null;
    }).filter(Boolean),
    enabled: getSettings().community_enabled === '1',
  });
});

router.post('/moderation/mute/:userId', requireAuth, (req, res) => {
  if (!isStaff(req.user)) throw forbidden('Área restrita à moderação.');
  const target = int(req.params.userId, { min: 1, field: 'usuário' });
  const minutes = int(req.body.minutes ?? 15, { min: 1, max: 10080, field: 'duração' });
  const reason = str(req.body.reason, { min: 3, max: 200, field: 'motivo' });
  const user = get('SELECT * FROM users WHERE id = ?', [target]);
  if (!user) throw notFound('Usuário não encontrado.');
  if (user.role === 'admin' && req.user.role !== 'admin') throw forbidden('Moderadores não podem silenciar administradores.');
  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  run('INSERT INTO mutes (user_id, muted_until, reason, created_by, created_at) VALUES (?, ?, ?, ?, ?)', [
    target,
    until,
    reason,
    req.user.id,
    nowIso(),
  ]);
  run(
    'INSERT INTO admin_logs (actor_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, 'community.mute', 'user', String(target), `${minutes} min — ${reason}`, nowIso()],
  );
  res.json({ ok: true, mutedUntil: until });
});

router.delete('/moderation/mute/:userId', requireAuth, (req, res) => {
  if (!isStaff(req.user)) throw forbidden('Área restrita à moderação.');
  const target = int(req.params.userId, { min: 1, field: 'usuário' });
  run('UPDATE mutes SET muted_until = ? WHERE user_id = ? AND muted_until > ?', [nowIso(), target, nowIso()]);
  run(
    'INSERT INTO admin_logs (actor_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, 'community.unmute', 'user', String(target), 'Silenciamento removido', nowIso()],
  );
  res.json({ ok: true });
});

router.post('/moderation/reports/:id', requireAuth, (req, res) => {
  if (!isStaff(req.user)) throw forbidden('Área restrita à moderação.');
  const id = int(req.params.id, { min: 1, field: 'denúncia' });
  const status = String(req.body.status || 'resolved');
  if (!['resolved', 'dismissed'].includes(status)) throw badRequest('Status inválido.');
  const note = String(req.body.note || '').slice(0, 300);
  if (!get('SELECT id FROM reports WHERE id = ?', [id])) throw notFound('Denúncia não encontrada.');
  run('UPDATE reports SET status = ?, resolved_at = ?, resolved_by = ?, resolution_note = ? WHERE id = ?', [
    status,
    nowIso(),
    req.user.id,
    note,
    id,
  ]);
  run(
    'INSERT INTO admin_logs (actor_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, `community.report_${status}`, 'report', String(id), note, nowIso()],
  );
  res.json({ ok: true });
});

router.post('/moderation/chat-enabled', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') throw forbidden('Apenas administradores podem alterar esta configuração.');
  const enabled = req.body.enabled === true || req.body.enabled === '1';
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ['community_enabled', enabled ? '1' : '0'],
  );
  run(
    'INSERT INTO admin_logs (actor_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, 'community.toggle', 'settings', 'community_enabled', enabled ? 'ativado' : 'desativado', nowIso()],
  );
  broadcast('chat-state', { enabled });
  res.json({ ok: true, enabled });
});

export { publicUser };
export default router;
