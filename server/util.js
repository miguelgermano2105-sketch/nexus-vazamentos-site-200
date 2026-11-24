import { run, nowIso } from './db.js';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Autenticação necessária.') => new HttpError(401, msg);
export const forbidden = (msg = 'Ação não permitida.') => new HttpError(403, msg);
export const notFound = (msg = 'Recurso não encontrado.') => new HttpError(404, msg);

export function str(value, { min = 1, max = 5000, field = 'campo' } = {}) {
  if (typeof value !== 'string') throw badRequest(`O ${field} é obrigatório.`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw badRequest(`O ${field} deve ter pelo menos ${min} caractere(s).`);
  if (trimmed.length > max) throw badRequest(`O ${field} deve ter no máximo ${max} caracteres.`);
  return trimmed;
}

export function optionalStr(value, { max = 5000, field = 'campo' } = {}) {
  if (value === undefined || value === null || value === '') return '';
  return str(value, { min: 0, max, field });
}

export function int(value, { min = 0, max = Number.MAX_SAFE_INTEGER, field = 'valor' } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw badRequest(`O ${field} é inválido.`);
  }
  return parsed;
}

export function bool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export function email(value) {
  const clean = str(value, { min: 5, max: 160, field: 'e-mail' }).toLowerCase();
  if (!EMAIL_RE.test(clean)) throw badRequest('Informe um e-mail válido.');
  return clean;
}

export function username(value) {
  const clean = str(value, { min: 3, max: 24, field: 'nome de usuário' });
  if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
    throw badRequest('O nome de usuário aceita apenas letras, números, ponto, hífen e sublinhado.');
  }
  return clean;
}

export function password(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw badRequest('A senha deve ter pelo menos 8 caracteres.');
  }
  if (value.length > 200) throw badRequest('A senha é muito longa.');
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    throw badRequest('A senha deve conter letras e números.');
  }
  return value;
}

export function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || `item-${Date.now()}`;
}

/** Aceita apenas data URLs de imagem pequenas, evitando uploads abusivos. */
export function imageDataUrl(value, { maxBytes = 900_000, field = 'imagem' } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value);
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    if (raw.length > 600) throw badRequest(`A URL da ${field} é muito longa.`);
    return raw;
  }
  const match = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(raw);
  if (!match) throw badRequest(`Formato de ${field} inválido. Use PNG, JPG, WEBP ou GIF.`);
  const bytes = Math.floor((match[2].length * 3) / 4);
  if (bytes > maxBytes) {
    throw badRequest(`A ${field} deve ter no máximo ${Math.round(maxBytes / 1024)} KB.`);
  }
  return raw;
}

export function logAdmin(actorId, action, targetType = null, targetId = null, details = '') {
  run(
    'INSERT INTO admin_logs (actor_id, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [actorId, action, targetType, targetId === null ? null : String(targetId), details, nowIso()],
  );
}

export function notify(userId, title, body = '', link = null) {
  run(
    'INSERT INTO notifications (user_id, title, body, link, read_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)',
    [userId, title, body, link, nowIso()],
  );
}

/** Bloqueia links maliciosos e encurtadores no chat público. */
const BLOCKED_HOSTS = [
  'bit.ly', 'tinyurl.com', 'goo.gl', 'is.gd', 'cutt.ly', 't.co', 'encurtador.com.br',
  'discord-gift', 'steamcommunity-gift', 'free-nitro', 'nitro-gift',
];

export function containsUnsafeLink(text) {
  const urls = String(text).match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
  for (const url of urls) {
    const host = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0].toLowerCase();
    if (BLOCKED_HOSTS.some((blocked) => host.includes(blocked))) return true;
  }
  return false;
}

export function countLinks(text) {
  return (String(text).match(/https?:\/\//gi) || []).length;
}

export function paginate(query, total, page, perPage) {
  return {
    items: query,
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}
