import express from 'express';
import rateLimit from 'express-rate-limit';
import { all, get, run, nowIso, getSettings, setSetting } from '../db.js';
import { requireAuth } from '../auth.js';
import { HttpError, badRequest, str, int, notFound, forbidden } from '../util.js';

const router = express.Router();

const AI_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
const AI_BASE_URL = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const AI_MODEL = process.env.AI_MODEL || '';

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : req.ip),
  message: { error: 'Muitas mensagens em pouco tempo. Aguarde um instante.' },
});

const configured = () => Boolean(AI_KEY);

function dailyUsage(userId) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return get(
    `SELECT COUNT(*) AS n FROM ai_messages m
     JOIN ai_conversations c ON c.id = m.conversation_id
     WHERE c.user_id = ? AND m.role = 'assistant' AND m.created_at >= ?`,
    [userId, start.toISOString()],
  ).n;
}

function limits() {
  const settings = getSettings();
  return {
    enabled: settings.ai_enabled !== '0',
    dailyLimit: Math.max(1, Number(settings.ai_daily_limit) || 40),
    model: AI_MODEL || settings.ai_model || 'gpt-4o-mini',
  };
}

router.get('/status', requireAuth, (req, res) => {
  const cfg = limits();
  const used = dailyUsage(req.user.id);
  res.json({
    enabled: cfg.enabled,
    configured: configured(),
    model: cfg.model,
    dailyLimit: cfg.dailyLimit,
    used,
    remaining: Math.max(0, cfg.dailyLimit - used),
    provider: configured() ? new URL(AI_BASE_URL).host : null,
  });
});

router.get('/conversations', requireAuth, (req, res) => {
  const rows = all(
    `SELECT c.id, c.title, c.created_at, c.updated_at,
            (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) AS messages
     FROM ai_conversations c WHERE c.user_id = ? ORDER BY c.updated_at DESC LIMIT 60`,
    [req.user.id],
  );
  res.json({ conversations: rows });
});

router.post('/conversations', requireAuth, (req, res) => {
  const title = req.body?.title ? str(req.body.title, { min: 1, max: 80, field: 'título' }) : 'Nova conversa';
  const now = nowIso();
  const { lastInsertRowid } = run(
    'INSERT INTO ai_conversations (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [req.user.id, title, now, now],
  );
  res.status(201).json({
    conversation: { id: lastInsertRowid, title, created_at: now, updated_at: now, messages: 0 },
  });
});

function ownConversation(userId, id) {
  const conv = get('SELECT * FROM ai_conversations WHERE id = ?', [id]);
  if (!conv) throw notFound('Conversa não encontrada.');
  if (conv.user_id !== userId) throw forbidden('Esta conversa pertence a outro usuário.');
  return conv;
}

router.get('/conversations/:id', requireAuth, (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'conversa' });
  const conv = ownConversation(req.user.id, id);
  const messages = all(
    'SELECT id, role, content, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY id ASC',
    [id],
  );
  res.json({ conversation: conv, messages });
});

router.delete('/conversations/:id', requireAuth, (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'conversa' });
  ownConversation(req.user.id, id);
  run('DELETE FROM ai_messages WHERE conversation_id = ?', [id]);
  run('DELETE FROM ai_conversations WHERE id = ?', [id]);
  res.json({ ok: true });
});

router.post('/conversations/:id/messages', requireAuth, chatLimiter, async (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'conversa' });
  const conv = ownConversation(req.user.id, id);
  const content = str(req.body.content, { min: 1, max: 4000, field: 'mensagem' });
  const cfg = limits();

  if (!cfg.enabled) throw new HttpError(503, 'A NEXUS AI está temporariamente desativada pela administração.');
  if (!configured()) {
    throw new HttpError(
      503,
      'A NEXUS AI ainda não está conectada. Um administrador precisa configurar a chave da API de inteligência artificial nas variáveis de ambiente do servidor.',
    );
  }
  const used = dailyUsage(req.user.id);
  if (used >= cfg.dailyLimit) {
    throw new HttpError(429, `Limite diário de ${cfg.dailyLimit} mensagens atingido. Volte amanhã ou fale com a administração.`);
  }

  const history = all(
    'SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 40',
    [id],
  );
  run('INSERT INTO ai_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)', [
    id,
    'user',
    content,
    nowIso(),
  ]);

  const systemPrompt = getSettings().ai_system_prompt || 'Você é a NEXUS AI.';
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  let reply = '';
  try {
    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_KEY}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.6,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`[nexus:ai] provider ${response.status}: ${detail.slice(0, 300)}`);
      const message =
        response.status === 401
          ? 'A chave da API de inteligência artificial foi recusada. Verifique a configuração no servidor.'
          : response.status === 429
            ? 'O provedor de inteligência artificial está com limite de uso atingido. Tente novamente em instantes.'
            : 'O provedor de inteligência artificial retornou um erro. Tente novamente.';
      throw new HttpError(response.status === 401 ? 503 : 502, message);
    }

    const data = await response.json();
    reply = data?.choices?.[0]?.message?.content?.trim() || '';
    if (!reply) throw new HttpError(502, 'A NEXUS AI retornou uma resposta vazia. Tente reformular a pergunta.');
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err.name === 'AbortError') {
      throw new HttpError(504, 'A NEXUS AI demorou demais para responder. Tente novamente.');
    }
    console.error('[nexus:ai] falha de rede:', err.message);
    throw new HttpError(502, 'Não foi possível contatar o provedor de inteligência artificial agora.');
  } finally {
    clearTimeout(timeout);
  }

  run('INSERT INTO ai_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)', [
    id,
    'assistant',
    reply,
    nowIso(),
  ]);

  const messageCount = get('SELECT COUNT(*) AS n FROM ai_messages WHERE conversation_id = ?', [id]).n;
  if (messageCount <= 2 && (conv.title === 'Nova conversa' || !conv.title)) {
    const title = content.length > 60 ? `${content.slice(0, 57)}...` : content;
    run('UPDATE ai_conversations SET title = ? WHERE id = ?', [title, id]);
  }
  run('UPDATE ai_conversations SET updated_at = ? WHERE id = ?', [nowIso(), id]);

  const remaining = Math.max(0, cfg.dailyLimit - (used + 1));
  res.json({ reply, remaining, conversationId: id, model: cfg.model });
});

/** Ajuste do limite diário pelo próprio administrador (painel). */
router.post('/limit', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') throw badRequest('Apenas administradores podem alterar este limite.');
  const value = int(req.body.dailyLimit, { min: 1, max: 500, field: 'limite diário' });
  setSetting('ai_daily_limit', value);
  res.json({ ok: true, dailyLimit: value });
});

export default router;
