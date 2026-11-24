import crypto from 'node:crypto';
import { get, run, nowIso } from './db.js';

const SESSION_COOKIE = 'nexus_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export const ROLES = { MEMBER: 'member', MODERATOR: 'moderator', ADMIN: 'admin' };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = crypto.scryptSync(password, salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const chunk of header.split(';')) {
    const idx = chunk.indexOf('=');
    if (idx === -1) continue;
    const key = chunk.slice(0, idx).trim();
    const value = chunk.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function createSession(res, userId, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  run(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    [
      sha256(token),
      userId,
      new Date(now).toISOString(),
      new Date(now + SESSION_TTL_MS).toISOString(),
      (req.ip || '').slice(0, 60),
      String(req.headers['user-agent'] || '').slice(0, 200),
    ],
  );
  res.append('Set-Cookie', sessionCookie(token, req));
  return token;
}

/** Monta o cookie de sessão com validade longa (30 dias, renováveis). */
function sessionCookie(token, req) {
  const secure = (req.headers['x-forwarded-proto'] || req.protocol || 'http') === 'https';
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function destroySession(req, res) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', [sha256(token)]);
  res.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function destroyAllSessionsForUser(userId) {
  run('DELETE FROM sessions WHERE user_id = ?', [userId]);
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    displayName: row.display_name,
    avatar: row.avatar || null,
    bio: row.bio || '',
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function findUserById(id) {
  return get('SELECT * FROM users WHERE id = ?', [id]);
}

/** Recupera o usuário autenticado a partir do cookie de sessão. */
export function resolveUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const hash = sha256(token);
  const session = get('SELECT * FROM sessions WHERE token_hash = ?', [hash]);
  if (!session) return null;
  const expiresAt = new Date(session.expires_at).getTime();
  if (expiresAt < Date.now()) {
    run('DELETE FROM sessions WHERE token_hash = ?', [hash]);
    return null;
  }
  const user = findUserById(session.user_id);
  if (!user || user.status !== 'active') return null;
  req.session = { token, hash, expiresAt };
  return user;
}

export function attachUser(req, res, next) {
  req.user = resolveUser(req);
  if (req.user) {
    const now = Date.now();
    if (!req.user.last_seen_at || now - new Date(req.user.last_seen_at).getTime() > 60_000) {
      run('UPDATE users SET last_seen_at = ? WHERE id = ?', [nowIso(), req.user.id]);
    }
    touchPresence(req.user.id);

    /*
     * Renovação deslizante: ao usar o site a sessão é estendida por mais 30 dias,
     * então quem volta sempre continua conectado. Só expira após 30 dias sem acesso.
     */
    if (req.session && req.session.expiresAt - now < SESSION_TTL_MS / 2) {
      run('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', [
        new Date(now + SESSION_TTL_MS).toISOString(),
        req.session.hash,
      ]);
      res.append('Set-Cookie', sessionCookie(req.session.token, req));
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Autenticação necessária.' });
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Autenticação necessária.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissão insuficiente para esta ação.' });
    }
    next();
  };
}

export const isStaff = (user) => !!user && (user.role === 'admin' || user.role === 'moderator');

/* ---------------- Presença em tempo real (comunidade) ---------------- */

const presence = new Map(); // userId -> { lastSeen, connections }

export function touchPresence(userId) {
  const entry = presence.get(userId) || { lastSeen: 0, connections: 0 };
  entry.lastSeen = Date.now();
  presence.set(userId, entry);
}

export function openConnection(userId) {
  const entry = presence.get(userId) || { lastSeen: Date.now(), connections: 0 };
  entry.connections += 1;
  entry.lastSeen = Date.now();
  presence.set(userId, entry);
}

export function closeConnection(userId) {
  const entry = presence.get(userId);
  if (!entry) return;
  entry.connections = Math.max(0, entry.connections - 1);
  entry.lastSeen = Date.now();
  presence.set(userId, entry);
}

export function onlineUserIds(ttlMs = 75_000) {
  const now = Date.now();
  return [...presence.entries()]
    .filter(([, v]) => v.connections > 0 || now - v.lastSeen < ttlMs)
    .map(([id]) => id);
}

export function clearPresence(userId) {
  presence.delete(userId);
}

export function cleanupSessions() {
  run('DELETE FROM sessions WHERE expires_at < ?', [nowIso()]);
  run('DELETE FROM password_resets WHERE expires_at < ?', [nowIso()]);
}
