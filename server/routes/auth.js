import express from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { get, run, all, nowIso, getSettings } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  destroyAllSessionsForUser,
  publicUser,
  requireAuth,
  ROLES,
} from '../auth.js';
import {
  HttpError,
  badRequest,
  str,
  optionalStr,
  email,
  username,
  password,
  imageDataUrl,
  logAdmin,
  notify,
} from '../util.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

router.get('/setup-status', (req, res) => {
  const admin = get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  res.json({ needsAdmin: !admin, signedIn: !!req.user });
});

/** Primeiro administrador: permitido apenas enquanto não existir nenhum admin. */
router.post('/claim-admin', authLimiter, (req, res) => {
  const admin = get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (admin) throw new HttpError(409, 'Já existe um administrador configurado. Entre com suas credenciais.');

  const mail = email(req.body.email);
  const user = username(req.body.username);
  const pass = password(req.body.password);
  const displayName = optionalStr(req.body.displayName, { max: 40 }) || user;

  if (get('SELECT id FROM users WHERE email = ?', [mail])) throw badRequest('Este e-mail já está em uso.');
  if (get('SELECT id FROM users WHERE username = ?', [user])) throw badRequest('Este nome de usuário já está em uso.');

  const created = nowIso();
  const { lastInsertRowid } = run(
    `INSERT INTO users (email, username, display_name, password_hash, role, status, created_at)
     VALUES (?, ?, ?, ?, 'admin', 'active', ?)`,
    [mail, user, displayName, hashPassword(pass), created],
  );
  createSession(res, lastInsertRowid, req);
  logAdmin(lastInsertRowid, 'admin.bootstrap', 'user', lastInsertRowid, 'Administrador inicial criado');
  res.status(201).json({ user: publicUser(get('SELECT * FROM users WHERE id = ?', [lastInsertRowid])) });
});

router.post('/register', authLimiter, (req, res) => {
  const mail = email(req.body.email);
  const user = username(req.body.username);
  const pass = password(req.body.password);
  const displayName = optionalStr(req.body.displayName, { max: 40 }) || user;

  if (get('SELECT id FROM users WHERE email = ?', [mail])) throw badRequest('Este e-mail já está cadastrado.');
  if (get('SELECT id FROM users WHERE username = ?', [user])) throw badRequest('Este nome de usuário já está em uso.');

  const created = nowIso();
  const { lastInsertRowid } = run(
    `INSERT INTO users (email, username, display_name, password_hash, role, status, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, 'member', 'active', ?, ?)`,
    [mail, user, displayName, hashPassword(pass), created, created],
  );
  createSession(res, lastInsertRowid, req);
  notify(
    lastInsertRowid,
    'Bem-vindo à NEXUS VAZAMENTOS',
    'Sua conta está ativa. Explore a biblioteca, converse com a NEXUS AI e participe da NEXUS Community.',
    '/conteudos',
  );
  res.status(201).json({ user: publicUser(get('SELECT * FROM users WHERE id = ?', [lastInsertRowid])) });
});

router.post('/login', authLimiter, (req, res) => {
  const identifier = str(req.body.identifier ?? req.body.email, { min: 3, max: 160, field: 'e-mail ou usuário' });
  const pass = typeof req.body.password === 'string' ? req.body.password : '';
  if (!pass) throw badRequest('Informe sua senha.');

  const user = EMAIL_RE.test(identifier)
    ? get('SELECT * FROM users WHERE email = ?', [identifier.toLowerCase()])
    : get('SELECT * FROM users WHERE username = ?', [identifier]);

  if (!user || !verifyPassword(pass, user.password_hash)) {
    throw new HttpError(401, 'Credenciais inválidas. Verifique e tente novamente.');
  }
  if (user.status !== 'active') {
    throw new HttpError(403, `Conta suspensa. ${user.suspended_reason || 'Fale com a administração.'}`);
  }

  createSession(res, user.id, req);
  run('UPDATE users SET last_seen_at = ? WHERE id = ?', [nowIso(), user.id]);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch('/profile', requireAuth, (req, res) => {
  const displayName = str(req.body.displayName, { min: 2, max: 40, field: 'nome de exibição' });
  const bio = optionalStr(req.body.bio, { max: 280, field: 'bio' });
  const avatar = imageDataUrl(req.body.avatar, { field: 'foto', maxBytes: 700_000 });

  let newUsername = req.user.username;
  if (req.body.username && req.body.username !== req.user.username) {
    newUsername = username(req.body.username);
    const taken = get('SELECT id FROM users WHERE username = ? AND id != ?', [newUsername, req.user.id]);
    if (taken) throw badRequest('Este nome de usuário já está em uso.');
  }

  run('UPDATE users SET display_name = ?, bio = ?, avatar = ?, username = ? WHERE id = ?', [
    displayName,
    bio,
    avatar,
    newUsername,
    req.user.id,
  ]);
  res.json({ user: publicUser(get('SELECT * FROM users WHERE id = ?', [req.user.id])) });
});

router.post('/change-password', requireAuth, authLimiter, (req, res) => {
  const current = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  const next = password(req.body.newPassword);
  if (!verifyPassword(current, req.user.password_hash)) {
    throw new HttpError(400, 'A senha atual está incorreta.');
  }
  run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(next), req.user.id]);
  destroyAllSessionsForUser(req.user.id);
  createSession(res, req.user.id, req);
  logAdmin(req.user.id, 'auth.password_changed', 'user', req.user.id, 'Senha alterada pelo próprio usuário');
  res.json({ ok: true });
});

/**
 * Recuperação de senha: gera um link de uso único.
 * Sem provedor de e-mail configurado, o link fica disponível para a administração
 * no painel administrativo (nunca é devolvido ao solicitante anônimo).
 */
router.post('/forgot-password', authLimiter, (req, res) => {
  const identifier = str(req.body.identifier, { min: 3, max: 160, field: 'e-mail' });
  const user = EMAIL_RE.test(identifier)
    ? get('SELECT * FROM users WHERE email = ?', [identifier.toLowerCase()])
    : get('SELECT * FROM users WHERE username = ?', [identifier]);

  if (user) {
    const token = crypto.randomBytes(32).toString('base64url');
    run(
      'INSERT INTO password_resets (token_hash, user_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)',
      [sha256(token), user.id, nowIso(), new Date(Date.now() + 60 * 60 * 1000).toISOString()],
    );
    console.log(`[nexus:recuperacao] ${user.email} -> /redefinir-senha?token=${token}`);
    notify(
      user.id,
      'Recuperação de senha solicitada',
      'Se não foi você, ignore este aviso e altere sua senha.',
      '/perfil',
    );
  }
  res.json({
    ok: true,
    message:
      'Se a conta existir, um link de recuperação válido por 1 hora foi gerado. Sem serviço de e-mail configurado, solicite o link à administração pelo painel administrativo.',
  });
});

router.post('/reset-password', authLimiter, (req, res) => {
  const token = str(req.body.token, { min: 20, max: 200, field: 'token' });
  const next = password(req.body.password);
  const record = get('SELECT * FROM password_resets WHERE token_hash = ?', [sha256(token)]);
  if (!record || record.used_at || new Date(record.expires_at).getTime() < Date.now()) {
    throw badRequest('Link de recuperação inválido ou expirado. Solicite um novo.');
  }
  run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(next), record.user_id]);
  run('UPDATE password_resets SET used_at = ? WHERE token_hash = ?', [nowIso(), record.token_hash]);
  destroyAllSessionsForUser(record.user_id);
  logAdmin(record.user_id, 'auth.password_reset', 'user', record.user_id, 'Senha redefinida via link');
  res.json({ ok: true });
});

/** Área do membro: visão geral, favoritos, histórico e notificações. */
router.get('/overview', requireAuth, (req, res) => {
  const uid = req.user.id;
  const favorites = all(
    `SELECT p.id, p.title, p.slug, p.description, p.image_url, c.name AS category_name, c.slug AS category_slug, f.created_at
     FROM favorites f JOIN posts p ON p.id = f.post_id JOIN categories c ON c.id = p.category_id
     WHERE f.user_id = ? ORDER BY f.created_at DESC LIMIT 12`,
    [uid],
  );
  const history = all(
    `SELECT p.id, p.title, p.slug, p.description, c.name AS category_name, c.slug AS category_slug, h.viewed_at
     FROM history h JOIN posts p ON p.id = h.post_id JOIN categories c ON c.id = p.category_id
     WHERE h.user_id = ? ORDER BY h.viewed_at DESC LIMIT 12`,
    [uid],
  );
  const notifications = all(
    'SELECT id, title, body, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
    [uid],
  );
  const counts = {
    favorites: get('SELECT COUNT(*) AS n FROM favorites WHERE user_id = ?', [uid]).n,
    history: get('SELECT COUNT(*) AS n FROM history WHERE user_id = ?', [uid]).n,
    unread: get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', [uid]).n,
    messages: get('SELECT COUNT(*) AS n FROM community_messages WHERE user_id = ? AND deleted_at IS NULL', [uid]).n,
  };
  const announcements = all(
    'SELECT id, title, body, level, created_at FROM announcements WHERE active = 1 ORDER BY created_at DESC LIMIT 5',
  );
  res.json({
    user: publicUser(req.user),
    counts,
    favorites,
    history,
    notifications,
    announcements,
    settings: { siteName: getSettings().site_name, discordUrl: getSettings().discord_url },
  });
});

router.post('/notifications/read', requireAuth, (req, res) => {
  run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [nowIso(), req.user.id]);
  res.json({ ok: true });
});

router.get('/sessions', requireAuth, (req, res) => {
  const rows = all(
    'SELECT token_hash, created_at, expires_at, ip, user_agent FROM sessions WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id],
  );
  res.json({
    sessions: rows.map((r) => ({
      id: r.token_hash.slice(0, 8),
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      ip: r.ip,
      userAgent: r.user_agent,
    })),
  });
});

export default router;
export { ROLES };
