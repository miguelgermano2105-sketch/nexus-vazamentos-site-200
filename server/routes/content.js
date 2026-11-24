import express from 'express';
import { all, get, run, nowIso, getSettings } from '../db.js';
import { requireAuth } from '../auth.js';
import { notFound, paginate, int, badRequest } from '../util.js';

const router = express.Router();

const PUBLIC_SETTINGS = [
  'site_name',
  'site_description',
  'site_tagline',
  'logo_text',
  'discord_url',
  'community_enabled',
  'community_rules',
  'ai_enabled',
];

router.get('/settings/public', (_req, res) => {
  const settings = getSettings();
  const out = {};
  for (const key of PUBLIC_SETTINGS) out[key] = settings[key] ?? null;
  res.json({ settings: out });
});

router.get('/categories', (_req, res) => {
  const rows = all(
    `SELECT c.id, c.slug, c.name, c.description, c.sort_order,
            (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id AND p.status = 'published') AS total
     FROM categories c ORDER BY c.sort_order ASC, c.name ASC`,
  );
  res.json({ categories: rows });
});

const SORTS = {
  recent: 'p.created_at DESC',
  oldest: 'p.created_at ASC',
  popular: 'p.views DESC, p.created_at DESC',
  title: 'p.title COLLATE NOCASE ASC',
};

router.get('/posts', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const featured = req.query.featured === '1';
  const sort = SORTS[String(req.query.sort)] || SORTS.recent;
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(48, Math.max(4, Number(req.query.perPage) || 9));

  const where = ["p.status = 'published'"];
  const params = [];
  if (q) {
    where.push('(p.title LIKE ? OR p.description LIKE ? OR p.body LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (category && category !== 'todas') {
    where.push('c.slug = ?');
    params.push(category);
  }
  if (featured) where.push('p.featured = 1');
  const clause = `WHERE ${where.join(' AND ')}`;

  const total = get(
    `SELECT COUNT(*) AS n FROM posts p JOIN categories c ON c.id = p.category_id ${clause}`,
    params,
  ).n;

  const rows = all(
    `SELECT p.id, p.title, p.slug, p.description, p.image_url, p.featured, p.views, p.created_at,
            c.name AS category_name, c.slug AS category_slug
     FROM posts p JOIN categories c ON c.id = p.category_id
     ${clause} ORDER BY ${sort} LIMIT ? OFFSET ?`,
    [...params, perPage, (page - 1) * perPage],
  );

  res.json(paginate(rows, total, page, perPage));
});

router.get('/posts/:slug', (req, res) => {
  const post = get(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug, u.display_name AS author_name
     FROM posts p JOIN categories c ON c.id = p.category_id
     LEFT JOIN users u ON u.id = p.author_id
     WHERE p.slug = ? AND p.status = 'published'`,
    [req.params.slug],
  );
  if (!post) throw notFound('Conteúdo não encontrado.');

  run('UPDATE posts SET views = views + 1 WHERE id = ?', [post.id]);
  let favorited = false;
  if (req.user) {
    favorited = !!get('SELECT 1 AS x FROM favorites WHERE user_id = ? AND post_id = ?', [req.user.id, post.id]);
    run('INSERT INTO history (user_id, post_id, viewed_at) VALUES (?, ?, ?)', [req.user.id, post.id, nowIso()]);
  }

  const related = all(
    `SELECT p.id, p.title, p.slug, p.description, c.name AS category_name
     FROM posts p JOIN categories c ON c.id = p.category_id
     WHERE p.status = 'published' AND p.category_id = ? AND p.id != ?
     ORDER BY p.created_at DESC LIMIT 4`,
    [post.category_id, post.id],
  );

  res.json({ post: { ...post, views: post.views + 1 }, favorited, related });
});

router.post('/posts/:id/favorite', requireAuth, (req, res) => {
  const id = int(req.params.id, { min: 1, field: 'conteúdo' });
  const post = get("SELECT id FROM posts WHERE id = ? AND status = 'published'", [id]);
  if (!post) throw notFound('Conteúdo não encontrado.');

  const existing = get('SELECT 1 AS x FROM favorites WHERE user_id = ? AND post_id = ?', [req.user.id, id]);
  if (existing) {
    run('DELETE FROM favorites WHERE user_id = ? AND post_id = ?', [req.user.id, id]);
    return res.json({ favorited: false });
  }
  run('INSERT INTO favorites (user_id, post_id, created_at) VALUES (?, ?, ?)', [req.user.id, id, nowIso()]);
  res.json({ favorited: true });
});

router.get('/favorites', requireAuth, (req, res) => {
  const rows = all(
    `SELECT p.id, p.title, p.slug, p.description, p.image_url, c.name AS category_name, c.slug AS category_slug, f.created_at
     FROM favorites f JOIN posts p ON p.id = f.post_id JOIN categories c ON c.id = p.category_id
     WHERE f.user_id = ? ORDER BY f.created_at DESC`,
    [req.user.id],
  );
  res.json({ favorites: rows });
});

router.get('/announcements', (_req, res) => {
  const rows = all(
    'SELECT id, title, body, level, created_at FROM announcements WHERE active = 1 ORDER BY created_at DESC LIMIT 10',
  );
  res.json({ announcements: rows });
});

router.get('/home', (req, res) => {
  const settings = getSettings();
  const featured = all(
    `SELECT p.id, p.title, p.slug, p.description, p.image_url, p.views, p.created_at,
            c.name AS category_name, c.slug AS category_slug
     FROM posts p JOIN categories c ON c.id = p.category_id
     WHERE p.status = 'published' AND p.featured = 1 ORDER BY p.created_at DESC LIMIT 6`,
  );
  const recent = all(
    `SELECT p.id, p.title, p.slug, p.description, p.image_url, p.views, p.created_at,
            c.name AS category_name, c.slug AS category_slug
     FROM posts p JOIN categories c ON c.id = p.category_id
     WHERE p.status = 'published' ORDER BY p.created_at DESC LIMIT 6`,
  );
  const categories = all(
    `SELECT c.id, c.slug, c.name, c.description,
            (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id AND p.status = 'published') AS total
     FROM categories c ORDER BY c.sort_order ASC`,
  );
  const announcements = all(
    'SELECT id, title, body, level, created_at FROM announcements WHERE active = 1 ORDER BY created_at DESC LIMIT 3',
  );
  const stats = {
    posts: get("SELECT COUNT(*) AS n FROM posts WHERE status = 'published'").n,
    members: get("SELECT COUNT(*) AS n FROM users WHERE status = 'active'").n,
    categories: get('SELECT COUNT(*) AS n FROM categories').n,
    messages: get('SELECT COUNT(*) AS n FROM community_messages WHERE deleted_at IS NULL').n,
  };
  let favoriteIds = [];
  if (req.user) {
    favoriteIds = all('SELECT post_id FROM favorites WHERE user_id = ?', [req.user.id]).map((r) => r.post_id);
  }
  res.json({
    featured,
    recent,
    categories,
    announcements,
    stats,
    favoriteIds,
    settings: {
      siteName: settings.site_name,
      description: settings.site_description,
      tagline: settings.site_tagline,
      discordUrl: settings.discord_url,
      communityEnabled: settings.community_enabled === '1',
      aiEnabled: settings.ai_enabled === '1',
    },
  });
});

router.post('/reports/content', requireAuth, (req, res) => {
  const postId = int(req.body.postId, { min: 1, field: 'conteúdo' });
  const reason = String(req.body.reason || '').trim().slice(0, 400);
  if (reason.length < 5) throw badRequest('Descreva o motivo da denúncia.');
  const post = get('SELECT id FROM posts WHERE id = ?', [postId]);
  if (!post) throw notFound('Conteúdo não encontrado.');
  run(
    'INSERT INTO reports (message_id, reporter_id, reason, status, created_at) VALUES (NULL, ?, ?, ?, ?)',
    [req.user.id, `[conteúdo #${postId}] ${reason}`, 'open', nowIso()],
  );
  res.status(201).json({ ok: true });
});

export default router;
