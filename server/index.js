import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import rateLimit from 'express-rate-limit';
import { attachUser, hashPassword, cleanupSessions } from './auth.js';
import { get, run, getSettings } from './db.js';
import { HttpError } from './util.js';
import { startHeartbeat } from './realtime.js';
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import aiRoutes from './routes/ai.js';
import communityRoutes from './routes/community.js';
import adminRoutes from './routes/admin.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(here, '..', 'dist');
const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "script-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  );
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(attachUser);

/** Proteção CSRF básica: origens cruzadas não podem alterar estado. */
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  try {
    const originHost = new URL(origin).host;
    if (originHost !== req.headers.host) {
      return res.status(403).json({ error: 'Origem não autorizada.' });
    }
  } catch {
    return res.status(403).json({ error: 'Origem inválida.' });
  }
  next();
});

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 400,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde um instante.' },
});
app.use('/api', globalLimiter);

app.get('/api/health', (_req, res) => {
  const settings = getSettings();
  res.json({
    ok: true,
    app: 'NEXUS VAZAMENTOS',
    signature: 'DESENVOLVIDO POR SILVA',
    siteName: settings.site_name,
    aiConfigured: Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY),
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', contentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado.' });
});

if (fs.existsSync(DIST)) {
  app.use(
    express.static(DIST, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res
      .status(503)
      .type('html')
      .send(
        '<h1 style="font-family:system-ui;padding:40px">NEXUS VAZAMENTOS</h1><p style="font-family:system-ui;padding:0 40px">Build do frontend não encontrado. Execute <code>npm run build</code>.</p>',
      );
  });
}

app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Arquivo ou requisição muito grande.' });
  }
  console.error('[nexus:error]', err);
  res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
});

/** Administrador inicial via variáveis de ambiente (opcional). */
function bootstrapAdmin() {
  const mail = process.env.ADMIN_EMAIL;
  const pass = process.env.ADMIN_PASSWORD;
  const existing = get("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
  if (existing || !mail || !pass) return;
  if (pass.length < 10) {
    console.warn('[nexus:admin] ADMIN_PASSWORD precisa de pelo menos 10 caracteres — bootstrap ignorado.');
    return;
  }
  const created = new Date().toISOString();
  const username = (process.env.ADMIN_USERNAME || 'silva').toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  run(
    `INSERT INTO users (email, username, display_name, password_hash, role, status, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?)`,
    [mail.toLowerCase(), username, 'SILVA', hashPassword(pass), created, created],
  );
  console.log(`[nexus:admin] Administrador inicial criado para ${mail}`);
}

bootstrapAdmin();
cleanupSessions();
setInterval(cleanupSessions, 1000 * 60 * 60).unref?.();
startHeartbeat();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NEXUS VAZAMENTOS — servidor em http://0.0.0.0:${PORT}`);
  console.log('DESENVOLVIDO POR SILVA');
});
