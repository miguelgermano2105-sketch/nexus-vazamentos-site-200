/**
 * NEXUS VAZAMENTOS — teste de integração ponta a ponta.
 * Sobe o servidor real em uma porta isolada e um banco temporário,
 * exercitando os fluxos críticos da plataforma. DESENVOLVIDO POR SILVA.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 3411;
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-'));

let passed = 0;
const failures = [];

function ok(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function jar() {
  return { cookie: '' };
}

async function call(method, pathname, { body, session } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (session?.cookie) headers.Cookie = session.cookie;
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (session) {
    const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const pair = raw.split(';')[0];
      if (pair.endsWith('=')) continue;
      session.cookie = pair;
    }
  }
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

const server = spawn(process.execPath, ['server/index.js'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(PORT),
    DATA_DIR: dataDir,
    DB_FILE: path.join(dataDir, 'test.db'),
    ADMIN_EMAIL: '',
    ADMIN_PASSWORD: '',
    AI_API_KEY: '',
    OPENAI_API_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const serverLog = [];
server.stdout.on('data', (d) => serverLog.push(String(d)));
server.stderr.on('data', (d) => serverLog.push(String(d)));

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function shutdown() {
  try {
    server.kill('SIGTERM');
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

async function main() {
  const up = await waitForServer();
  ok('servidor inicia e responde /api/health', up, serverLog.join('').slice(-400));
  if (!up) return;

  const health = await call('GET', '/api/health');
  ok('health identifica a plataforma', health.json?.app === 'NEXUS VAZAMENTOS');
  ok('health expõe a assinatura oficial', health.json?.signature === 'DESENVOLVIDO POR SILVA');
  ok('IA marcada como não configurada sem chave', health.json?.aiConfigured === false);

  /* ---------------------------- primeiro acesso ---------------------------- */
  const admin = jar();
  const setup = await call('GET', '/api/auth/setup-status');
  ok('setup-status indica ausência de administrador', setup.json?.needsAdmin === true);

  const claim = await call('POST', '/api/auth/claim-admin', {
    session: admin,
    body: { email: 'silva@nexus.test', username: 'silva', password: 'SenhaMuitoForte123', displayName: 'SILVA' },
  });
  ok('criação do administrador inicial', claim.status === 201 && claim.json?.user?.role === 'admin', `status ${claim.status}`);
  ok('sessão do administrador é criada por cookie', admin.cookie.startsWith('nexus'), admin.cookie.slice(0, 40));

  const secondClaim = await call('POST', '/api/auth/claim-admin', {
    body: { email: 'outro@nexus.test', username: 'outro', password: 'OutraSenhaForte123' },
  });
  ok('segundo claim-admin é recusado', secondClaim.status === 409, `status ${secondClaim.status}`);

  /* ------------------------- cadastro, login e perfil ------------------------- */
  const member = jar();
  const register = await call('POST', '/api/auth/register', {
    session: member,
    body: { email: 'membro@nexus.test', username: 'membro', password: 'MembroForte123', displayName: 'Membro Teste' },
  });
  ok('cadastro de membro', register.status === 201 || register.status === 200, `status ${register.status}`);

  const weak = await call('POST', '/api/auth/register', {
    body: { email: 'fraco@nexus.test', username: 'fraco', password: '123' },
  });
  ok('cadastro rejeita senha fraca', weak.status === 400, `status ${weak.status}`);

  const me = await call('GET', '/api/auth/me', { session: member });
  ok('sessão autenticada devolve o usuário', me.json?.user?.username === 'membro');
  ok('senha nunca é devolvida pela API', !JSON.stringify(me.json).includes('password'));

  const anonymous = await call('GET', '/api/auth/me');
  ok('visitante não é autenticado', anonymous.status === 200 && !anonymous.json?.user);

  const login = await call('POST', '/api/auth/login', {
    session: member,
    body: { identifier: 'membro', password: 'MembroForte123' },
  });
  ok('login por nome de usuário', login.status === 200 && login.json?.user?.username === 'membro', `status ${login.status}`);

  const badLogin = await call('POST', '/api/auth/login', { body: { identifier: 'membro', password: 'errada12345' } });
  ok('login com senha incorreta é recusado', badLogin.status === 401, `status ${badLogin.status}`);

  const profile = await call('PATCH', '/api/auth/profile', {
    session: member,
    body: { displayName: 'Membro Renomeado', bio: 'Bio de teste' },
  });
  ok('edição de perfil', profile.status === 200 && profile.json?.user?.displayName === 'Membro Renomeado');

  /* --------------------------------- RBAC --------------------------------- */
  const forbidden = await call('GET', '/api/admin/dashboard', { session: member });
  ok('membro não acessa painel administrativo', forbidden.status === 403, `status ${forbidden.status}`);

  const dashboard = await call('GET', '/api/admin/dashboard', { session: admin });
  ok('administrador acessa dashboard', dashboard.status === 200 && dashboard.json?.stats, `status ${dashboard.status}`);

  /* ------------------------------- conteúdos ------------------------------- */
  const category = await call('POST', '/api/admin/categories', {
    session: admin,
    body: { name: 'Tutoriais', description: 'Guias passo a passo' },
  });
  ok('criação de categoria', category.status === 201 && category.json?.category?.name === 'Tutoriais', `status ${category.status}`);

  const categoryId = category.json?.category?.id;
  const post = await call('POST', '/api/admin/posts', {
    session: admin,
    body: {
      title: 'Primeiro tutorial NEXUS',
      description: 'Como usar a plataforma do começo ao fim.',
      body: 'Conteúdo completo do tutorial, com passos detalhados.',
      categoryId,
      status: 'published',
      featured: true,
    },
  });
  ok('criação de publicação', post.status === 201 && post.json?.post?.id, `status ${post.status}`);

  const postId = post.json?.post?.id;
  const postSlug = post.json?.post?.slug;

  const list = await call('GET', '/api/posts');
  ok('listagem pública de publicações', list.status === 200 && (list.json?.items?.length ?? 0) >= 1, `status ${list.status}`);
  ok('paginação informa o total', (list.json?.total ?? 0) >= 1 && (list.json?.totalPages ?? 0) >= 1);

  const search = await call('GET', '/api/posts?q=tutorial');
  ok('pesquisa encontra a publicação', (search.json?.items?.length ?? 0) >= 1);

  const emptySearch = await call('GET', '/api/posts?q=zzzznaoexiste');
  ok('pesquisa sem resultado devolve lista vazia', (emptySearch.json?.items?.length ?? -1) === 0);

  const detail = await call('GET', `/api/posts/${postSlug}`);
  ok('detalhe da publicação por slug', detail.status === 200 && detail.json?.post?.body?.length > 0);

  const favorite = await call('POST', `/api/posts/${postId}/favorite`, { session: member });
  ok('favoritar publicação', favorite.status === 200 && favorite.json?.favorited === true, `status ${favorite.status}`);

  const favorites = await call('GET', '/api/favorites', { session: member });
  ok('favoritos do membro', (favorites.json?.posts?.length ?? favorites.json?.favorites?.length ?? 0) === 1);

  const overview = await call('GET', '/api/auth/overview', { session: member });
  ok('painel do membro carrega visão geral', overview.status === 200 && overview.json?.user);

  const home = await call('GET', '/api/home');
  ok('homepage recebe dados da API', home.status === 200 && Array.isArray(home.json?.featured));

  const publicSettings = await call('GET', '/api/settings/public');
  ok(
    'configurações públicas expõem o Discord',
    (publicSettings.json?.settings?.discord_url || '').includes('discord.gg/YKcYA7g2v'),
    JSON.stringify(publicSettings.json?.settings ?? {}).slice(0, 120),
  );
  ok('configurações públicas não vazam segredos', !/api[_-]?key|secret|password/i.test(JSON.stringify(publicSettings.json ?? {})));

  const aiProbe = await call('POST', '/api/admin/ai/test', { session: admin });
  ok(
    'diagnóstico de IA informa ausência de chave',
    aiProbe.status === 400 && /chave/i.test(aiProbe.json?.error || ''),
    `status ${aiProbe.status}`,
  );

  /* ------------------------------ comunidade ------------------------------ */
  const rules = await call('GET', '/api/community/rules');
  ok('regras da comunidade visíveis', rules.status === 200 && typeof rules.json?.rules === 'string');

  const guestSend = await call('POST', '/api/community/messages', { body: { body: 'oi' } });
  ok('visitante não pode enviar mensagem', guestSend.status === 401, `status ${guestSend.status}`);

  const sent = await call('POST', '/api/community/messages', { session: member, body: { body: 'Primeira mensagem na comunidade' } });
  ok('membro envia mensagem', sent.status === 201 && sent.json?.message?.id, `status ${sent.status}`);

  const messageId = sent.json?.message?.id;
  const messages = await call('GET', '/api/community/messages');
  ok('histórico do chat devolve a mensagem', (messages.json?.messages ?? []).some((m) => m.id === messageId));

  const online = await call('GET', '/api/community/online');
  ok('lista de membros online', Array.isArray(online.json?.online));

  const report = await call('POST', `/api/community/messages/${messageId}/report`, {
    session: admin,
    body: { reason: 'Teste de denúncia automatizado' },
  });
  ok('denúncia de mensagem', report.status === 200 || report.status === 201, `status ${report.status}`);

  const moderation = await call('GET', '/api/community/moderation', { session: admin });
  ok('painel de moderação lista denúncias', (moderation.json?.reports?.length ?? 0) >= 1);

  const mute = await call('POST', `/api/community/moderation/mute/${me.json?.user?.id}`, {
    session: admin,
    body: { minutes: 5, reason: 'Teste de silenciamento' },
  });
  ok('moderador silencia usuário', mute.status === 200 || mute.status === 201, `status ${mute.status}`);

  const mutedSend = await call('POST', '/api/community/messages', { session: member, body: { body: 'Mensagem durante silêncio' } });
  ok('usuário silenciado não envia mensagem', mutedSend.status === 403, `status ${mutedSend.status}`);

  const unmute = await call('DELETE', `/api/community/moderation/mute/${me.json?.user?.id}`, { session: admin });
  ok('silenciamento removido', unmute.status === 200, `status ${unmute.status}`);

  const deleteMessage = await call('DELETE', `/api/community/messages/${messageId}`, { session: admin });
  ok('administrador apaga mensagem', deleteMessage.status === 200, `status ${deleteMessage.status}`);

  const logs = await call('GET', '/api/admin/logs', { session: admin });
  ok('ações administrativas registradas em log', (logs.json?.logs?.length ?? 0) >= 1);

  /* --------------------------------- NEXUS AI -------------------------------- */
  const aiStatus = await call('GET', '/api/ai/status', { session: member });
  ok('status da IA acessível ao membro', aiStatus.status === 200 && aiStatus.json?.configured === false);
  ok('limite diário de IA informado', typeof aiStatus.json?.dailyLimit === 'number');

  const conversation = await call('POST', '/api/ai/conversations', { session: member, body: { title: 'Conversa de teste' } });
  ok('criação de conversa com a IA', conversation.status === 201 && conversation.json?.conversation?.id, `status ${conversation.status}`);

  const conversationId = conversation.json?.conversation?.id;
  const conversationList = await call('GET', '/api/ai/conversations', { session: member });
  ok('histórico de conversas', (conversationList.json?.conversations?.length ?? 0) === 1);

  const aiSend = await call('POST', `/api/ai/conversations/${conversationId}/messages`, {
    session: member,
    body: { content: 'Como uso a plataforma?' },
  });
  ok(
    'IA sem chave devolve erro controlado (sem resposta simulada)',
    aiSend.status >= 400 && aiSend.status < 600 && typeof aiSend.json?.error === 'string',
    `status ${aiSend.status}`,
  );

  const deleted = await call('DELETE', `/api/ai/conversations/${conversationId}`, { session: member });
  ok('exclusão de conversa', deleted.status === 200, `status ${deleted.status}`);

  /* ----------------------------- senha e sessão ----------------------------- */
  const forgot = await call('POST', '/api/auth/forgot-password', { body: { identifier: 'membro@nexus.test' } });
  ok('recuperação de senha responde sem vazar dados', forgot.status === 200 && forgot.json?.ok === true);

  const change = await call('POST', '/api/auth/change-password', {
    session: member,
    body: { currentPassword: 'MembroForte123', newPassword: 'NovaSenhaForte456' },
  });
  ok('alteração de senha', change.status === 200, `status ${change.status}`);

  const oldPassword = await call('POST', '/api/auth/login', { body: { identifier: 'membro', password: 'MembroForte123' } });
  ok('senha antiga deixa de funcionar', oldPassword.status === 401, `status ${oldPassword.status}`);

  const newPassword = await call('POST', '/api/auth/login', { body: { identifier: 'membro', password: 'NovaSenhaForte456' } });
  ok('nova senha funciona', newPassword.status === 200, `status ${newPassword.status}`);

  const logout = await call('POST', '/api/auth/logout', { session: member });
  ok('logout encerra a sessão', logout.status === 200);

  const afterLogout = await call('GET', '/api/auth/me', { session: member });
  ok('sessão encerrada não autentica', !afterLogout.json?.user);

  /* ------------------------------ suspensão ------------------------------ */
  const suspend = await call('PATCH', `/api/admin/users/${me.json?.user?.id}`, {
    session: admin,
    body: { status: 'suspended', suspendedReason: 'Teste automatizado' },
  });
  ok('administrador suspende conta', suspend.status === 200, `status ${suspend.status}`);

  const suspendedLogin = await call('POST', '/api/auth/login', {
    body: { identifier: 'membro', password: 'NovaSenhaForte456' },
  });
  ok('conta suspensa não entra', suspendedLogin.status === 403, `status ${suspendedLogin.status}`);

  const reactivate = await call('PATCH', `/api/admin/users/${me.json?.user?.id}`, { session: admin, body: { status: 'active' } });
  ok('administrador reativa conta', reactivate.status === 200, `status ${reactivate.status}`);
}

main()
  .catch((err) => {
    failures.push(`erro inesperado: ${err.message}`);
    console.error(err);
  })
  .finally(() => {
    console.log(`\n${passed} verificações aprovadas, ${failures.length} falha(s).`);
    if (failures.length) {
      console.log('Falhas:');
      for (const f of failures) console.log(` - ${f}`);
    }
    shutdown();
    process.exit(failures.length ? 1 : 0);
  });
