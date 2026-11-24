import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = process.env.DATA_DIR || path.join(here, '..', 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'nexus.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const SQL = await initSqlJs({
  locateFile: (file) => require.resolve(`sql.js/dist/${file}`),
});

const db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();

let dirty = false;
let flushTimer = null;

function persistNow() {
  if (!dirty) return;
  dirty = false;
  try {
    const bytes = Buffer.from(db.export());
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error('[nexus:db] falha ao gravar banco:', err.message);
  }
}

function markDirty() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    persistNow();
  }, 150);
}

export function flushDatabase() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  persistNow();
}

process.on('SIGTERM', () => { flushDatabase(); process.exit(0); });
process.on('SIGINT', () => { flushDatabase(); process.exit(0); });
process.on('exit', () => persistNow());

/** Executa um SELECT e devolve array de objetos. */
export function all(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

/** Executa um SELECT e devolve a primeira linha ou null. */
export function get(sql, params = []) {
  const rows = all(sql, params);
  return rows.length ? rows[0] : null;
}

/** Executa uma escrita e devolve { lastInsertRowid, changes }. */
export function run(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    stmt.step();
  } finally {
    stmt.free();
  }
  const changes = db.getRowsModified();
  const res = db.exec('SELECT last_insert_rowid() AS id');
  const lastInsertRowid = res.length ? Number(res[0].values[0][0]) : 0;
  markDirty();
  return { lastInsertRowid, changes };
}

export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    markDirty();
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }
}

export const nowIso = () => new Date().toISOString();

export function getSetting(key, fallback = null) {
  const row = get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, String(value)],
  );
}

export function getSettings() {
  const rows = all('SELECT key, value FROM settings');
  const out = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  bio TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  suspended_reason TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  access_url TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  author_id INTEGER REFERENCES users(id),
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, post_id)
);
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'info',
  active INTEGER NOT NULL DEFAULT 1,
  author_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS community_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  reply_to_id INTEGER REFERENCES community_messages(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER REFERENCES community_messages(id) ON DELETE CASCADE,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by INTEGER REFERENCES users(id),
  resolution_note TEXT
);
CREATE TABLE IF NOT EXISTS blocks (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, blocked_user_id)
);
CREATE TABLE IF NOT EXISTS mutes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_until TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conversation_id, id);
CREATE INDEX IF NOT EXISTS idx_community_created ON community_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_created ON admin_logs(created_at DESC);
`;

db.exec('PRAGMA foreign_keys = ON;');
db.exec(SCHEMA);

const DEFAULT_SETTINGS = {
  site_name: 'NEXUS VAZAMENTOS',
  site_description:
    'Plataforma digital premium de conteúdos selecionados, comunidade em tempo real e inteligência artificial própria.',
  site_tagline: 'Conteúdo, comunidade e inteligência em um só lugar.',
  logo_text: 'NEXUS',
  discord_url: 'https://discord.gg/YKcYA7g2v',
  community_enabled: '1',
  community_rules:
    'Respeite todos os membros. Proibido spam, divulgação não autorizada, discurso de ódio, conteúdo ilegal, links maliciosos e compartilhamento de dados privados de terceiros.',
  ai_enabled: '1',
  ai_model: 'gpt-4o-mini',
  ai_daily_limit: '40',
  ai_system_prompt:
    'Você é a NEXUS AI, assistente oficial da plataforma NEXUS VAZAMENTOS. Responda em português do Brasil, de forma objetiva, educada e profissional. Ajude com dúvidas sobre a plataforma, conteúdos, tutoriais, ideias e textos. Nunca forneça dados pessoais de terceiros, credenciais, senhas vazadas ou material ilegal. Se o pedido for ilegal ou antiético, recuse com educação e ofereça uma alternativa legal.',
  effects_default: 'on',
};

for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  if (!get('SELECT key FROM settings WHERE key = ?', [key])) setSetting(key, value);
}

const SEED_CATEGORIES = [
  ['tutoriais', 'Tutoriais', 'Guias passo a passo para dominar ferramentas e processos.', 1],
  ['sites-e-ferramentas', 'Sites e Ferramentas', 'Plataformas e utilitários que aceleram o seu trabalho.', 2],
  ['modelos', 'Modelos', 'Templates, estruturas e bases prontas para adaptar.', 3],
  ['frases', 'Frases', 'Textos curtos, legendas e copywriting de alta conversão.', 4],
  ['jogos', 'Jogos', 'Experiências interativas, assets e sistemas para games.', 5],
  ['cursos', 'Cursos', 'Trilhas de aprendizado e materiais de estudo.', 6],
  ['extensoes', 'Extensões', 'Complementos e automações para o seu navegador.', 7],
  ['outros', 'Outros', 'Conteúdos especiais e novidades da plataforma.', 8],
];

if (!get('SELECT id FROM categories LIMIT 1')) {
  for (const [slug, name, description, sort] of SEED_CATEGORIES) {
    run('INSERT INTO categories (slug, name, description, sort_order) VALUES (?, ?, ?, ?)', [
      slug,
      name,
      description,
      sort,
    ]);
  }
}

const SEED_POSTS = [
  {
    title: 'Primeiros passos na NEXUS',
    slug: 'primeiros-passos-na-nexus',
    category: 'tutoriais',
    featured: 1,
    description: 'Aprenda a configurar seu perfil, salvar favoritos e explorar a biblioteca em poucos minutos.',
    body: 'A NEXUS foi construída para ser direta: crie sua conta, escolha um nome de exibição, adicione uma foto e comece a explorar.\n\n1. Abra "Criar conta" e defina e-mail, usuário e senha forte.\n2. No painel do membro, ajuste sua foto e sua bio.\n3. Use a busca da biblioteca para filtrar por categoria e ordenar por recentes ou populares.\n4. Favorite o que quiser rever — seus favoritos e o histórico ficam salvos na sua conta, disponíveis em qualquer dispositivo.\n5. Participe da NEXUS Community com respeito às regras de convivência.\n\nDica: ative ou desative efeitos visuais em Configurações para deixar a experiência do seu jeito.',
  },
  {
    title: 'Organizando sua rotina de estudos com a NEXUS AI',
    slug: 'rotina-de-estudos-com-nexus-ai',
    category: 'tutoriais',
    featured: 1,
    description: 'Um método prático para transformar objetivos em um plano de estudos semanal com apoio da IA.',
    body: 'A NEXUS AI funciona melhor quando você dá contexto. Em vez de perguntar "me ajude a estudar", descreva objetivo, tempo disponível e nível atual.\n\nModelo de pedido:\n"Quero aprender [tema] em [prazo]. Tenho [X horas] por semana e nível [iniciante/intermediário]. Monte um plano semanal com entregas e formas de revisão."\n\nDepois peça ajustes: "reduza para 3 dias por semana", "adicione exercícios práticos", "crie um resumo de 10 linhas do tópico 2".\n\nMantenha cada objetivo em uma conversa separada: o histórico fica salvo e você retoma o contexto quando quiser.',
  },
  {
    title: 'Checklist de segurança digital para membros',
    slug: 'checklist-de-seguranca-digital',
    category: 'tutoriais',
    featured: 1,
    description: 'Sete verificações rápidas para proteger suas contas e seus dados pessoais.',
    body: 'Segurança é hábito. Revise esta lista a cada trimestre:\n\n1. Senhas únicas por serviço, com no mínimo 12 caracteres.\n2. Gerenciador de senhas em vez de anotações.\n3. Verificação em duas etapas nas contas principais.\n4. Nunca compartilhe códigos de verificação.\n5. Confira o domínio antes de digitar credenciais.\n6. Mantenha navegador e sistema atualizados.\n7. Desconfie de ofertas que pedem pressa.\n\nA NEXUS nunca solicita sua senha por chat, e-mail ou redes sociais.',
  },
  {
    title: 'Ferramentas de produtividade que realmente economizam tempo',
    slug: 'ferramentas-de-produtividade',
    category: 'sites-e-ferramentas',
    description: 'Seleção de utilitários gratuitos para organizar tarefas, notas e automações simples.',
    body: 'Uma boa pilha de produtividade tem no máximo cinco ferramentas. Comece pelo essencial:\n\n• Captura de ideias: um único lugar para notas rápidas.\n• Tarefas: lista semanal com no máximo três prioridades por dia.\n• Automação: gatilhos simples entre formulário e planilha.\n• Foco: bloqueio de notificações em janelas de trabalho profundo.\n• Revisão: quinze minutos na sexta para fechar pendências e planejar a semana.\n\nFerramentas não substituem método. Escolha, configure uma vez e mantenha por 30 dias antes de trocar.',
  },
  {
    title: 'Como avaliar se uma ferramenta online é confiável',
    slug: 'avaliar-ferramenta-online',
    category: 'sites-e-ferramentas',
    description: 'Critérios objetivos de reputação, privacidade e suporte antes de confiar seus dados.',
    body: 'Antes de criar conta em qualquer serviço, verifique:\n\n1. Política de privacidade clara sobre uso e retenção de dados.\n2. Endereço do site com HTTPS válido.\n3. Existência de exportação dos seus dados.\n4. Suporte acessível e tempo de resposta.\n5. Reputação em comunidades independentes.\n6. Modelo de negócio compreensível — se é gratuito, entenda o motivo.\n\nSe algo não estiver claro, use a ferramenta apenas com dados não sensíveis.',
  },
  {
    title: 'Modelo de apresentação profissional em 10 slides',
    slug: 'modelo-apresentacao-10-slides',
    category: 'modelos',
    description: 'Estrutura pronta para pitch, proposta comercial ou apresentação de projeto.',
    body: 'Sequência recomendada:\n\n1. Problema em uma frase.\n2. Evidência do problema.\n3. Solução proposta.\n4. Como funciona em três passos.\n5. Diferencial competitivo.\n6. Público-alvo e tamanho de mercado.\n7. Modelo de receita ou de valor.\n8. Resultados ou validações.\n9. Roadmap de 90 dias.\n10. Pedido final (próximo passo concreto).\n\nRegra de ouro: uma ideia por slide, no máximo 25 palavras de texto e um elemento visual dominante.',
  },
  {
    title: 'Estrutura de landing page de alta conversão',
    slug: 'estrutura-landing-page',
    category: 'modelos',
    description: 'Blocos testados para transformar visitantes em cadastros.',
    body: 'Ordem dos blocos:\n\n1. Promessa principal + subtítulo de apoio.\n2. Prova social imediata.\n3. Problema e consequência.\n4. Como funciona (3 passos).\n5. Benefícios em formato de lista escaneável.\n6. Comparativo antes/depois.\n7. Objeções respondidas.\n8. Chamada para ação repetida.\n9. Perguntas frequentes.\n10. Rodapé com informações de contato.\n\nEscreva o título depois de escrever a página: ele costuma ficar melhor com o texto final em mãos.',
  },
  {
    title: 'Frases para bio profissional',
    slug: 'frases-bio-profissional',
    category: 'frases',
    description: 'Vinte e cinco frases curtas e elegantes para perfis e apresentações.',
    body: 'Escolha o tom e adapte:\n\n• "Transformo ideias em sistemas que funcionam."\n• "Design com intenção, código com propósito."\n• "Aprendo em público, entrego com método."\n• "Menos ruído, mais resultado."\n• "Curiosidade como processo, precisão como entrega."\n• "Construo experiências digitais que respeitam o tempo das pessoas."\n• "Dados para decidir, criatividade para diferenciar."\n• "Do problema ao produto, sem atalhos."\n• "Tecnologia bem feita é silenciosa."\n• "Foco no essencial, excelência no detalhe."\n\nPrefira uma frase concreta em vez de uma lista de adjetivos.',
  },
  {
    title: 'Frases de impacto para posts e anúncios',
    slug: 'frases-de-impacto',
    category: 'frases',
    description: 'Ganchos curtos para abrir publicações com atenção.',
    body: 'Ganchos que funcionam:\n\n• "Ninguém precisa de mais uma ferramenta. Precisa de um sistema."\n• "O problema quase nunca é falta de informação."\n• "Se depende de memória, não é processo."\n• "Simplicidade é resultado de decisões difíceis."\n• "Consistência vence intensidade."\n\nUse no máximo uma frase de impacto por publicação e sempre conecte ao conteúdo real.',
  },
  {
    title: 'Sistema de inventário para jogos web',
    slug: 'sistema-de-inventario-jogos',
    category: 'jogos',
    description: 'Lógica de itens, raridade e empilhamento para jogos em navegador.',
    body: 'Estrutura mínima de inventário:\n\n• Item: id, nome, ícone, raridade, peso, empilhável.\n• Slot: posição fixa com limite de quantidade.\n• Regras: capacidade total, empilhamento por tipo, bloqueio de duplicados únicos.\n• Ações: adicionar, remover, mover, equipar, descartar.\n\nRaridade sugerida: comum, incomum, raro, épico, lendário — cada nível com cor e peso próprios.\n\nSempre valide as ações no servidor: o cliente pode ser manipulado.',
  },
  {
    title: 'Como equilibrar dificuldade em jogos casuais',
    slug: 'equilibrar-dificuldade-jogos',
    category: 'jogos',
    description: 'Curvas de dificuldade e recompensas que mantêm o jogador engajado.',
    body: 'Princípios práticos:\n\n1. Ensine antes de desafiar: cada mecânica nova aparece em ambiente seguro.\n2. Aumente um fator por vez.\n3. Recompense progresso visível a cada 60 a 90 segundos.\n4. Evite derrotas por falta de informação.\n5. Ofereça recuperação: checkpoints generosos, custo de erro baixo.\n6. Meça onde as pessoas param e ajuste ali primeiro.\n\nDificuldade percebida vem mais de clareza do que de números.',
  },
  {
    title: 'Fundamentos de programação web — trilha inicial',
    slug: 'trilha-programacao-web',
    category: 'cursos',
    description: 'Sequência de estudo de 8 semanas para sair do zero ao primeiro projeto publicado.',
    body: 'Semana 1-2: HTML semântico e CSS (layout, flexbox, grid).\nSemana 3-4: JavaScript moderno (funções, arrays, async/await, DOM).\nSemana 5: Git, GitHub e deploy estático.\nSemana 6: Consumo de APIs e formulários.\nSemana 7: Backend com Node e banco de dados.\nSemana 8: Projeto final, autenticação e publicação.\n\nEntregáveis por semana, sempre um projeto pequeno funcionando. Estudo passivo não gera domínio: construa.',
  },
  {
    title: 'Trilha de design de interface',
    slug: 'trilha-design-de-interface',
    category: 'cursos',
    description: 'Do fundamento visual ao sistema de design aplicado em produto digital.',
    body: 'Módulo 1: hierarquia, contraste, espaçamento e tipografia.\nMódulo 2: cor e acessibilidade (contraste mínimo AA).\nMódulo 3: componentes e estados (hover, foco, erro, vazio, carregando).\nMódulo 4: grids responsivos e mobile-first.\nMódulo 5: movimento com propósito e respeito a prefers-reduced-motion.\nMódulo 6: sistema de design documentado.\n\nExercício final: redesenhar uma tela real e justificar cada decisão em uma frase.',
  },
  {
    title: 'Extensões de navegador para foco e leitura',
    slug: 'extensoes-foco-leitura',
    category: 'extensoes',
    description: 'Categorias de extensões que melhoram atenção, leitura e captura de conteúdo.',
    body: 'Categorias úteis:\n\n• Modo leitura: remove ruído visual de artigos.\n• Bloqueio de distrações: limita sites por janela de tempo.\n• Captura: salva trechos e páginas com etiquetas.\n• Tradutor contextual: seleção de texto sem sair da página.\n• Verificação ortográfica e de acessibilidade.\n\nInstale apenas de lojas oficiais, revise as permissões solicitadas e remova o que não usa há 30 dias.',
  },
  {
    title: 'Automação simples no navegador: o que é seguro',
    slug: 'automacao-segura-no-navegador',
    category: 'extensoes',
    description: 'Boas práticas para automatizar tarefas repetitivas sem expor credenciais.',
    body: 'Automatize o repetitivo, nunca o sensível.\n\nSeguro: preencher formulários internos, organizar abas, extrair dados de páginas públicas, gerar relatórios.\nEvite: armazenar senhas em scripts, contornar autenticação, raspar dados privados, burlar limites de serviços.\n\nRegras: escopo mínimo de permissões, execução revisada, nenhum token em código compartilhado.',
  },
  {
    title: 'NEXUS Community: regras de convivência',
    slug: 'nexus-community-regras',
    category: 'outros',
    featured: 1,
    description: 'O que esperamos de cada membro dentro do chat público da plataforma.',
    body: 'A NEXUS Community existe para troca real de conhecimento.\n\nPermitido: dúvidas, ajuda mútua, feedback respeitoso, divulgação de projetos próprios em contexto.\nProibido: spam, ofensas, discurso de ódio, conteúdo ilegal, links maliciosos, divulgação de dados pessoais de terceiros e tentativas de se passar por outra pessoa.\n\nModeração: mensagens podem ser removidas, contas silenciadas temporariamente ou suspensas. Todas as ações ficam registradas.\n\nDenuncie mensagens abusivas pelo botão de denúncia — a equipe analisa e responde pelo painel de moderação.',
  },
  {
    title: 'Como a NEXUS AI pensa e como usá-la melhor',
    slug: 'como-usar-a-nexus-ai',
    category: 'outros',
    featured: 1,
    description: 'Entenda limites, contexto e as melhores formas de pedir ajuda à inteligência da plataforma.',
    body: 'A NEXUS AI é a assistente oficial da plataforma. Ela conversa em português, mantém o contexto da conversa e ajuda com dúvidas sobre a NEXUS, conteúdo, textos, ideias e explicações técnicas.\n\nComo obter respostas melhores:\n1. Informe objetivo e contexto.\n2. Peça formato de saída (lista, tabela, resumo, passo a passo).\n3. Itere: peça ajustes em vez de recomeçar.\n4. Separe assuntos em conversas diferentes.\n\nLimites: a IA não acessa dados privados de terceiros, não fornece credenciais e não substitui aconselhamento profissional. Cada conta tem um limite diário de mensagens para manter o serviço disponível para todos.',
  },
];

if (!get('SELECT id FROM posts LIMIT 1')) {
  const catMap = new Map(all('SELECT id, slug FROM categories').map((c) => [c.slug, c.id]));
  const base = Date.now();
  SEED_POSTS.forEach((post, index) => {
    const created = new Date(base - (index + 1) * 8 * 60 * 60 * 1000).toISOString();
    run(
      `INSERT INTO posts (title, slug, description, body, image_url, category_id, access_url, featured, status, author_id, views, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', NULL, ?, ?, ?)`,
      [
        post.title,
        post.slug,
        post.description,
        post.body,
        null,
        catMap.get(post.category),
        null,
        post.featured ? 1 : 0,
        Math.floor(Math.random() * 240) + 12,
        created,
        created,
      ],
    );
  });
}

if (!get('SELECT id FROM announcements LIMIT 1')) {
  const created = nowIso();
  run(
    'INSERT INTO announcements (title, body, level, active, author_id, created_at, updated_at) VALUES (?, ?, ?, 1, NULL, ?, ?)',
    [
      'Bem-vindo à NEXUS VAZAMENTOS',
      'A plataforma está no ar. Explore a biblioteca, converse com a NEXUS AI e participe da NEXUS Community. Leia as regras de convivência antes de enviar sua primeira mensagem.',
      'info',
      created,
      created,
    ],
  );
  run(
    'INSERT INTO announcements (title, body, level, active, author_id, created_at, updated_at) VALUES (?, ?, ?, 1, NULL, ?, ?)',
    [
      'Conteúdo autorizado apenas',
      'A NEXUS publica somente materiais próprios, autorizados ou de domínio público. Não divulgamos dados pessoais, credenciais ou arquivos privados de terceiros.',
      'warning',
      created,
      created,
    ],
  );
}

export default db;
