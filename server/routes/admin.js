import express from 'express';
import { all, get, run, nowIso, getSettings, setSetting } from '../db.js';
import { requireAuth, requireRole, destroyAllSessionsForUser, hashPassword } from '../auth.js';
import {
  HttpError,
  badRequest,
  str,
  optionalStr,
  int,
  bool,
  email,
  username,
  password,
  imageDataUrl,
  slugify,
  logAdmin,
  notify,
} from '../util.js';
import { broadcast } from '../realtime.js';

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'moderator'));

const adminOnly = requireRole('admin');

router.get('/dashboard', (req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const stats = {
    users: get('SELECT COUNT(*) AS n FROM users').n,
    activeUsers: get('SELECT COUNT(*) AS n FROM users WHERE status = ?', ['active']).n,
    suspended: get('SELECT COUNT(*) AS n FROM users WHERE status = ?', ['suspended']).n,
    newUsers7d: get('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', [since]).n,
    posts: get("SELECT COUNT(*) AS n FROM posts WHERE status = 'published'").n,
    drafts: get("SELECT COUNT(*) AS n FROM posts WHERE status = 'draft'").n,
    categories: get('SELECT COUNT(*) AS n FROM categories').n,
    messages: get('SELECT COUNT(*) AS n FROM community_messages WHERE deleted_at IS NULL').n,
    messagesToday: get('SELECT COUNT(*) AS n FROM community_messages WHERE created_at >= ?', [
      new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString(),
    ]).n,
    openReports: get("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'").n,
    aiConversations: get('SELECT COUNT(*) AS n FROM ai_conversations').n,
    favorites: get('SELECT COUNT(*) AS n FROM favorites').n,
    views: get('SELECT COALESCE(SUM(views), 0) AS n FROM posts').n,
  };
  const recentUsers = all(
    'SELECT id, display_name, username, email, role, status, created_at FROM users ORDER BY created_at DESC LIMIT 6',
  );
  const recentPosts = all(
    `SELECT p.id, p.title, p.slug, p.status, p.created_at, c.name AS category_name
     FROM posts p JOIN categories c ON c.id = p.category_id ORDER BY p.created_at DESC LIMIT 6`,
  );
  const recentMessages = all(
    `SELECT m.id, m.body, m.created_at, u.display_name AS author FROM community_messages m
     JOIN users u ON u.id = m.user_id WHERE m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 6`,
  );
  const logs = all(
    `SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.created_at, u.display_name AS actor
     FROM admin_logs l LEFT JOIN users u ON u.id = l.actor_id ORDER BY l.created_at DESC LIMIT 12`,
  );
  const topPosts = all(
    "SELECT id, title, slug, views FROM posts WHERE status = 'published' ORDER BY views DESC LIMIT 5",
  );
  res.json({ stats, recentUsers, recentPosts, recentMessages, logs, topPosts });
});

/* ------------------------------- Usuários ------------------------------- */

router.get('/users', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = 20;
  const where = [];
  const params = [];
  if (q) {
    where.push('(display_name LIKE ? OR username LIKE ? OR email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (req.query.role && ['member', 'moderator', 'admin'].includes(String(req.query.role))) {
    where.push('role = ?');
    params.push(String(req.query.role));
  }
  if (req.query.status && ['active', 'suspended'].includes(String(req.query.status))) {
    where.push('status = ?');
    params.push(String(req.query.status));
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = get(`SELECT COUNT(*) AS n FROM users ${clause}`, params).n;
  const users = all(
    `SELECT id, email, username, display_name, avatar, bio, role, status, suspended_reason, created_at, last_seen_at
     FROM users ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, perPage, (page - 1) * perPage],
  );
  res.json({ users, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) });
});

router.patch('/users/:id', (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'usuário' });
  const target = get('SELECT * FROM users WHERE id = ?', [id]);
  if (!target) throw new HttpError(404, 'Usuário não encontrado.');

  if (target.role === 'admin' && req.user.role !== 'admin') {
    throw new HttpError(403, 'Apenas administradores podem alterar outro administrador.');
  }

  const updates = {};
  if (req.body.role !== undefined) {
    if (req.user.role !== 'admin') throw new HttpError(403, 'Apenas administradores alteram permissões.');
    const role = String(req.body.role);
    if (!['member', 'moderator', 'admin'].includes(role)) throw badRequest('Permissão inválida.');
    if (target.id === req.user.id && role !== 'admin') {
      throw badRequest('Você não pode remover sua própria permissão de administrador.');
    }
    updates.role = role;
  }
  if (req.body.status !== undefined) {
    const status = String(req.body.status);
    if (!['active', 'suspended'].includes(status)) throw badRequest('Status inválido.');
    if (target.id === req.user.id) throw badRequest('Você não pode suspender a própria conta.');
    if (target.role === 'admin' && req.user.role !== 'admin') {
      throw new HttpError(403, 'Moderadores não podem suspender administradores.');
    }
    updates.status = status;
    updates.suspended_reason = status === 'suspended' ? optionalStr(req.body.reason, { max: 200 }) : null;
    if (status === 'suspended') destroyAllSessionsForUser(id);
  }
  if (req.body.displayName !== undefined) {
    updates.display_name = str(req.body.displayName, { min: 2, max: 40, field: 'nome' });
  }
  if (req.body.email !== undefined) {
    const mail = email(req.body.email);
    const taken = get('SELECT id FROM users WHERE email = ? AND id != ?', [mail, id]);
    if (taken) throw badRequest('E-mail já utilizado por outro membro.');
    updates.email = mail;
  }
  if (req.body.newPassword !== undefined && req.body.newPassword !== '') {
    if (req.user.role !== 'admin') throw new HttpError(403, 'Apenas administradores redefinem senhas.');
    updates.password_hash = hashPassword(password(req.body.newPassword));
    destroyAllSessionsForUser(id);
  }

  const keys = Object.keys(updates);
  if (!keys.length) throw badRequest('Nenhuma alteração informada.');
  run(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => updates[k]), id]);

  logAdmin(req.user.id, 'admin.user_updated', 'user', id, `Campos: ${keys.join(', ')}`);
  if (updates.status === 'suspended') {
    notify(id, 'Conta suspensa', updates.suspended_reason || 'Fale com a administração para mais informações.');
  }
  res.json({ user: get('SELECT id, email, username, display_name, role, status, created_at FROM users WHERE id = ?', [id]) });
});

/* ------------------------------ Publicações ------------------------------ */

router.get('/posts', (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 80);
  const where = [];
  const params = [];
  if (q) {
    where.push('(p.title LIKE ? OR p.description LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (req.query.status && ['published', 'draft'].includes(String(req.query.status))) {
    where.push('p.status = ?');
    params.push(String(req.query.status));
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const posts = all(
    `SELECT p.id, p.title, p.slug, p.description, p.image_url, p.featured, p.status, p.views, p.access_url,
            p.category_id, c.name AS category_name, p.created_at, p.updated_at
     FROM posts p JOIN categories c ON c.id = p.category_id ${clause}
     ORDER BY p.created_at DESC LIMIT 200`,
    params,
  );
  res.json({ posts });
});

function postPayload(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.title !== undefined) out.title = str(body.title, { min: 3, max: 120, field: 'título' });
  if (!partial || body.description !== undefined) {
    out.description = str(body.description, { min: 10, max: 300, field: 'descrição' });
  }
  if (!partial || body.body !== undefined) out.body = optionalStr(body.body, { max: 20000, field: 'conteúdo' });
  if (!partial || body.categoryId !== undefined) {
    const categoryId = int(body.categoryId, { min: 1, field: 'categoria' });
    if (!get('SELECT id FROM categories WHERE id = ?', [categoryId])) throw badRequest('Categoria inexistente.');
    out.category_id = categoryId;
  }
  if (!partial || body.imageUrl !== undefined) out.image_url = imageDataUrl(body.imageUrl, { field: 'imagem' });
  if (!partial || body.accessUrl !== undefined) {
    const url = optionalStr(body.accessUrl, { max: 500, field: 'link de acesso' });
    if (url && !/^https?:\/\//i.test(url)) throw badRequest('O link de acesso deve começar com http:// ou https://');
    out.access_url = url || null;
  }
  if (body.featured !== undefined) out.featured = bool(body.featured) ? 1 : 0;
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!['published', 'draft'].includes(status)) throw badRequest('Status inválido.');
    out.status = status;
  }
  return out;
}

router.post('/posts', (req, res) => {
  const payload = postPayload(req.body);
  const base = slugify(payload.title);
  let slug = base;
  let i = 2;
  while (get('SELECT id FROM posts WHERE slug = ?', [slug])) slug = `${base}-${i++}`;
  const now = nowIso();
  const { lastInsertRowid } = run(
    `INSERT INTO posts (title, slug, description, body, image_url, category_id, access_url, featured, status, author_id, views, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      payload.title,
      slug,
      payload.description,
      payload.body || '',
      payload.image_url || null,
      payload.category_id,
      payload.access_url || null,
      payload.featured || 0,
      payload.status || 'published',
      req.user.id,
      now,
      now,
    ],
  );
  logAdmin(req.user.id, 'content.created', 'post', lastInsertRowid, payload.title);
  res.status(201).json({ post: get('SELECT * FROM posts WHERE id = ?', [lastInsertRowid]) });
});

router.patch('/posts/:id', (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'publicação' });
  if (!get('SELECT id FROM posts WHERE id = ?', [id])) throw new HttpError(404, 'Publicação não encontrada.');
  const payload = postPayload(req.body, { partial: true });
  const keys = Object.keys(payload);
  if (!keys.length) throw badRequest('Nenhuma alteração informada.');
  run(`UPDATE posts SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [
    ...keys.map((k) => payload[k]),
    nowIso(),
    id,
  ]);
  logAdmin(req.user.id, 'content.updated', 'post', id, `Campos: ${keys.join(', ')}`);
  res.json({ post: get('SELECT * FROM posts WHERE id = ?', [id]) });
});

router.delete('/posts/:id', adminOnly, (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'publicação' });
  const post = get('SELECT title FROM posts WHERE id = ?', [id]);
  if (!post) throw new HttpError(404, 'Publicação não encontrada.');
  run('DELETE FROM favorites WHERE post_id = ?', [id]);
  run('DELETE FROM history WHERE post_id = ?', [id]);
  run('DELETE FROM posts WHERE id = ?', [id]);
  logAdmin(req.user.id, 'content.deleted', 'post', id, post.title);
  res.json({ ok: true });
});

/* -------------------------------- Categorias ------------------------------ */

router.get('/categories', (_req, res) => {
  const rows = all(
    `SELECT c.*, (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id) AS total
     FROM categories c ORDER BY c.sort_order ASC, c.name ASC`,
  );
  res.json({ categories: rows });
});

router.post('/categories', adminOnly, (req, res) => {
  const name = str(req.body.name, { min: 2, max: 40, field: 'nome' });
  const description = optionalStr(req.body.description, { max: 200, field: 'descrição' });
  const base = slugify(name);
  let slug = base;
  let i = 2;
  while (get('SELECT id FROM categories WHERE slug = ?', [slug])) slug = `${base}-${i++}`;
  const sort = int(req.body.sortOrder ?? 99, { min: 0, max: 999, field: 'ordem' });
  const { lastInsertRowid } = run(
    'INSERT INTO categories (slug, name, description, sort_order) VALUES (?, ?, ?, ?)',
    [slug, name, description, sort],
  );
  logAdmin(req.user.id, 'category.created', 'category', lastInsertRowid, name);
  res.status(201).json({ category: get('SELECT * FROM categories WHERE id = ?', [lastInsertRowid]) });
});

router.patch('/categories/:id', adminOnly, (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'categoria' });
  if (!get('SELECT id FROM categories WHERE id = ?', [id])) throw new HttpError(404, 'Categoria não encontrada.');
  const name = str(req.body.name, { min: 2, max: 40, field: 'nome' });
  const description = optionalStr(req.body.description, { max: 200, field: 'descrição' });
  run('UPDATE categories SET name = ?, description = ? WHERE id = ?', [name, description, id]);
  logAdmin(req.user.id, 'category.updated', 'category', id, name);
  res.json({ ok: true });
});

router.delete('/categories/:id', adminOnly, (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'categoria' });
  const total = get('SELECT COUNT(*) AS n FROM posts WHERE category_id = ?', [id]).n;
  if (total > 0) throw badRequest('Mova ou exclua as publicações desta categoria antes de removê-la.');
  run('DELETE FROM categories WHERE id = ?', [id]);
  logAdmin(req.user.id, 'category.deleted', 'category', id, '');
  res.json({ ok: true });
});

/* -------------------------------- Comunicados ----------------------------- */

router.get('/announcements', (_req, res) => {
  res.json({ announcements: all('SELECT * FROM announcements ORDER BY created_at DESC') });
});

router.post('/announcements', (req, res) => {
  const title = str(req.body.title, { min: 3, max: 120, field: 'título' });
  const body = optionalStr(req.body.body, { max: 2000, field: 'conteúdo' });
  const level = ['info', 'warning', 'critical'].includes(String(req.body.level)) ? String(req.body.level) : 'info';
  const now = nowIso();
  const { lastInsertRowid } = run(
    'INSERT INTO announcements (title, body, level, active, author_id, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?)',
    [title, body, level, req.user.id, now, now],
  );
  logAdmin(req.user.id, 'announcement.created', 'announcement', lastInsertRowid, title);
  res.status(201).json({ announcement: get('SELECT * FROM announcements WHERE id = ?', [lastInsertRowid]) });
});

router.patch('/announcements/:id', (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'comunicado' });
  const current = get('SELECT * FROM announcements WHERE id = ?', [id]);
  if (!current) throw new HttpError(404, 'Comunicado não encontrado.');
  const title = req.body.title !== undefined ? str(req.body.title, { min: 3, max: 120, field: 'título' }) : current.title;
  const body = req.body.body !== undefined ? optionalStr(req.body.body, { max: 2000, field: 'conteúdo' }) : current.body;
  const level = ['info', 'warning', 'critical'].includes(String(req.body.level))
    ? String(req.body.level)
    : current.level;
  const active = req.body.active !== undefined ? (bool(req.body.active) ? 1 : 0) : current.active;
  run('UPDATE announcements SET title = ?, body = ?, level = ?, active = ?, updated_at = ? WHERE id = ?', [
    title,
    body,
    level,
    active,
    nowIso(),
    id,
  ]);
  logAdmin(req.user.id, 'announcement.updated', 'announcement', id, title);
  res.json({ ok: true });
});

router.delete('/announcements/:id', adminOnly, (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'comunicado' });
  run('DELETE FROM announcements WHERE id = ?', [id]);
  logAdmin(req.user.id, 'announcement.deleted', 'announcement', id, '');
  res.json({ ok: true });
});

/* --------------------------------- Ajustes -------------------------------- */

const EDITABLE_SETTINGS = [
  'site_name',
  'site_description',
  'site_tagline',
  'logo_text',
  'discord_url',
  'community_rules',
  'community_enabled',
  'ai_enabled',
  'ai_model',
  'ai_daily_limit',
  'ai_system_prompt',
  'effects_default',
];

router.get('/settings', adminOnly, (_req, res) => {
  const settings = getSettings();
  const out = {};
  for (const key of EDITABLE_SETTINGS) out[key] = settings[key] ?? '';
  res.json({
    settings: out,
    aiConfigured: Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY),
  });
});

router.put('/settings', adminOnly, (req, res) => {
  const incoming = req.body || {};
  const applied = [];
  for (const key of EDITABLE_SETTINGS) {
    if (incoming[key] === undefined) continue;
    let value = incoming[key];
    if (key === 'discord_url') {
      const url = str(value, { min: 10, max: 200, field: 'link do Discord' });
      if (!/^https:\/\/(discord\.gg|discord\.com)\//i.test(url)) throw badRequest('Informe um convite válido do Discord.');
      value = url;
    } else if (key === 'ai_daily_limit') {
      value = int(value, { min: 1, max: 500, field: 'limite diário da IA' });
    } else if (['community_enabled', 'ai_enabled'].includes(key)) {
      value = bool(value) ? '1' : '0';
    } else {
      value = optionalStr(value, { max: 4000, field: key });
    }
    setSetting(key, value);
    applied.push(key);
  }
  logAdmin(req.user.id, 'settings.updated', 'settings', null, applied.join(', '));
  broadcast('settings-updated', { keys: applied });
  res.json({ ok: true, applied });
});

/**
 * Diagnóstico da integração de IA: confirma chave, endpoint e modelo ativos.
 * Nunca devolve a chave; apenas o host do provedor e o resultado real da chamada.
 */
router.post('/ai/test', adminOnly, async (req, res) => {
  const key = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  if (!key) {
    throw badRequest(
      'Nenhuma chave de IA configurada. Defina OPENAI_API_KEY (ou AI_API_KEY) nas variáveis de ambiente do servidor e publique novamente.',
    );
  }

  const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const settings = getSettings();
  const model = process.env.AI_MODEL || settings.ai_model || 'gpt-4o-mini';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Responda apenas: ok' }],
        max_tokens: 8,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    const raw = await response.text().catch(() => '');

    if (!response.ok) {
      let code = '';
      let type = '';
      try {
        const parsed = JSON.parse(raw);
        code = parsed?.error?.code || '';
        type = parsed?.error?.type || '';
      } catch {
        // o provedor pode responder algo que não é JSON
      }
      const semCreditos =
        code === 'credit_balance_exhausted' ||
        type === 'insufficient_quota' ||
        /insufficient_quota|credit_balance_exhausted|no credits remaining/i.test(raw);
      if (semCreditos) {
        logAdmin(req.user.id, 'ai.test.failed', 'ai', null, 'sem_creditos');
        throw new HttpError(
          400,
          'A chave é válida, mas a conta do provedor está sem créditos. Adicione créditos em platform.openai.com (Billing) ou use outro provedor compatível em AI_BASE_URL.',
        );
      }
      const hints = {
        401: 'A chave foi recusada pelo provedor. Confira o valor de OPENAI_API_KEY.',
        403: 'A chave não tem permissão para usar este modelo ou endpoint.',
        404: 'Modelo ou endpoint não encontrado. Verifique AI_MODEL e AI_BASE_URL.',
        429: 'Limite de uso ou créditos do provedor esgotados. Verifique o plano da conta de IA.',
      };
      logAdmin(req.user.id, 'ai.test.failed', 'ai', null, `status=${response.status}`);
      throw new HttpError(
        400,
        hints[response.status] || `O provedor de IA respondeu ${response.status}. ${raw.slice(0, 160)}`,
      );
    }

    const data = JSON.parse(raw || '{}');
    const sample = String(data?.choices?.[0]?.message?.content || '').trim();
    logAdmin(req.user.id, 'ai.test.ok', 'ai', null, `model=${model}`);
    res.json({
      ok: true,
      model,
      provider: new URL(base).host,
      latencyMs: Date.now() - startedAt,
      sample: sample.slice(0, 160),
    });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err.name === 'AbortError') {
      throw new HttpError(504, 'O provedor de IA demorou demais para responder. Tente novamente.');
    }
    logAdmin(req.user.id, 'ai.test.failed', 'ai', null, `erro=${err.message}`);
    throw new HttpError(502, `Não foi possível contatar o provedor de IA: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
});

/* ------------------------------ Moderação/logs ---------------------------- */

router.get('/reports', (req, res) => {
  const status = ['open', 'resolved', 'dismissed'].includes(String(req.query.status))
    ? String(req.query.status)
    : 'open';
  const rows = all(
    `SELECT r.id, r.reason, r.status, r.created_at, r.resolved_at, r.resolution_note, r.message_id,
            m.body AS message_body, m.deleted_at, m.user_id AS author_id,
            au.display_name AS author_name, ru.display_name AS reporter_name, ru.id AS reporter_id
     FROM reports r
     LEFT JOIN community_messages m ON m.id = r.message_id
     LEFT JOIN users au ON au.id = m.user_id
     JOIN users ru ON ru.id = r.reporter_id
     WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 100`,
    [status],
  );
  res.json({ reports: rows });
});

router.delete('/messages/:id', (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'mensagem' });
  if (!get('SELECT id FROM community_messages WHERE id = ?', [id])) throw new HttpError(404, 'Mensagem não encontrada.');
  run('UPDATE community_messages SET deleted_at = ?, deleted_by = ? WHERE id = ?', [nowIso(), req.user.id, id]);
  logAdmin(req.user.id, 'community.message_deleted', 'message', id, 'Removida pela equipe');
  broadcast('message-deleted', { id });
  res.json({ ok: true });
});

router.get('/logs', adminOnly, (_req, res) => {
  const rows = all(
    `SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.created_at, u.display_name AS actor, u.username
     FROM admin_logs l LEFT JOIN users u ON u.id = l.actor_id ORDER BY l.created_at DESC LIMIT 200`,
  );
  res.json({ logs: rows });
});

router.get('/password-resets', adminOnly, (_req, res) => {
  const rows = all(
    `SELECT pr.user_id, pr.created_at, pr.expires_at, pr.used_at, u.email, u.display_name
     FROM password_resets pr JOIN users u ON u.id = pr.user_id
     WHERE pr.used_at IS NULL AND pr.expires_at > ? ORDER BY pr.created_at DESC LIMIT 50`,
    [nowIso()],
  );
  res.json({
    pending: rows,
    note: 'Sem provedor de e-mail configurado, o link completo aparece no log do servidor. Configure RESEND_API_KEY para envio automático.',
  });
});

router.get('/mutes', (_req, res) => {
  const rows = all(
    `SELECT mu.id, mu.user_id, mu.muted_until, mu.reason, mu.created_at, u.display_name, u.username
     FROM mutes mu JOIN users u ON u.id = mu.user_id WHERE mu.muted_until > ? ORDER BY mu.muted_until DESC`,
    [nowIso()],
  );
  res.json({ mutes: rows });
});

export { username };
export default router;
