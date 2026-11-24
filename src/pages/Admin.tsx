import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, adminApi, communityApi } from '../lib/api';
import type {
  AdminUser,
  Announcement,
  Category,
  DashboardData,
  ModerationData,
  Post,
  SiteSettings,
} from '../lib/types';
import { useApp } from '../state/AppContext';
import { Avatar, EmptyState, ErrorNote, LoadingBlock, Modal, RoleBadge } from '../components/ui';
import { categoryName, formatDate, formatDateTime, numberFmt, postImage, timeAgo } from '../lib/format';

type TabKey =
  | 'dashboard'
  | 'usuarios'
  | 'conteudos'
  | 'categorias'
  | 'avisos'
  | 'comunidade'
  | 'configuracoes'
  | 'logs';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'usuarios', label: 'Usuários' },
  { key: 'conteudos', label: 'Conteúdos' },
  { key: 'categorias', label: 'Categorias' },
  { key: 'avisos', label: 'Avisos' },
  { key: 'comunidade', label: 'Comunidade' },
  { key: 'configuracoes', label: 'Configurações' },
  { key: 'logs', label: 'Logs' },
];

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export default function Admin() {
  const { user, isAdmin } = useApp();
  const [params, setParams] = useSearchParams();
  const initial = (params.get('tab') as TabKey) || 'dashboard';
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === initial) ? initial : 'dashboard');

  const changeTab = (key: TabKey) => {
    setTab(key);
    setParams({ tab: key }, { replace: true });
  };

  return (
    <section className="section" style={{ paddingTop: 26 }}>
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow"><span className="dot" /> Painel administrativo</div>
            <h1 className="section-title">Central 22M</h1>
            <p className="section-desc">
              Olá, {user?.displayName}. Gerencie usuários, conteúdos, avisos e a comunidade.
              {!isAdmin ? ' Seu acesso é de moderador.' : ''}
            </p>
          </div>
          <span className="badge badge-admin">DESENVOLVIDO POR SILVA</span>
        </div>

        <div className="admin-tabs glass-panel">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`admin-tab${tab === t.key ? ' active' : ''}`}
              onClick={() => changeTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' ? <DashboardTab /> : null}
        {tab === 'usuarios' ? <UsersTab /> : null}
        {tab === 'conteudos' ? <PostsTab /> : null}
        {tab === 'categorias' ? <CategoriesTab /> : null}
        {tab === 'avisos' ? <AnnouncementsTab /> : null}
        {tab === 'comunidade' ? <CommunityTab /> : null}
        {tab === 'configuracoes' ? <SettingsTab isAdmin={isAdmin} /> : null}
        {tab === 'logs' ? <LogsTab isAdmin={isAdmin} /> : null}

        <p className="tiny text-muted" style={{ marginTop: 30, textAlign: 'center' }}>
          Todas as ações administrativas são verificadas no servidor e registradas em log.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------- Dashboard -------------------------------- */

function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminApi
      .dashboard()
      .then(setData)
      .catch((err) => setError(errMsg(err, 'Não foi possível carregar o dashboard.')));
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <LoadingBlock label="Carregando indicadores…" />;

  const s = data.stats;
  const cards = [
    { l: 'Usuários', v: s.users ?? 0 },
    { l: 'Ativos', v: s.activeUsers ?? 0 },
    { l: 'Suspensos', v: s.suspended ?? 0 },
    { l: 'Novos (7d)', v: s.newUsers7d ?? 0 },
    { l: 'Publicações', v: s.posts ?? 0 },
    { l: 'Rascunhos', v: s.drafts ?? 0 },
    { l: 'Categorias', v: s.categories ?? 0 },
    { l: 'Mensagens', v: s.messages ?? 0 },
    { l: 'Mensagens hoje', v: s.messagesToday ?? 0 },
    { l: 'Denúncias abertas', v: s.openReports ?? 0 },
    { l: 'Conversas IA', v: s.aiConversations ?? 0 },
    { l: 'Visualizações', v: s.views ?? 0 },
  ];

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.l} className="stat-card glass-panel">
            <div className="v">{numberFmt(c.v)}</div>
            <div className="l">{c.l}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="glass-panel" style={{ padding: 18 }}>
          <strong className="small">Atividade recente</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {data.logs.length ? (
              data.logs.map((l) => (
                <div key={l.id} className="list-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">{l.action}</div>
                    <div className="s">
                      {l.actor || 'sistema'} · {l.details || '—'}
                    </div>
                  </div>
                  <span className="tiny text-muted">{timeAgo(l.created_at)}</span>
                </div>
              ))
            ) : (
              <p className="tiny text-muted">Nenhum registro ainda.</p>
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 18 }}>
          <strong className="small">Novos membros</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {data.recentUsers.map((u) => (
              <div key={u.id} className="list-row">
                <Avatar name={u.display_name} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">{u.display_name}</div>
                  <div className="s">@{u.username}</div>
                </div>
                <RoleBadge role={u.role} />
              </div>
            ))}
          </div>

          <strong className="small" style={{ display: 'block', marginTop: 18 }}>Mais visualizados</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {data.topPosts.map((p) => (
              <div key={p.id} className="list-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">{p.title}</div>
                  <div className="s">{numberFmt(p.views)} visualizações</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 18 }}>
        <strong className="small">Últimas mensagens da comunidade</strong>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {data.recentMessages.length ? (
            data.recentMessages.map((m) => (
              <div key={m.id} className="list-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t" style={{ fontWeight: 400 }}>{m.body}</div>
                  <div className="s">{m.author} · {timeAgo(m.created_at)}</div>
                </div>
              </div>
            ))
          ) : (
            <p className="tiny text-muted">Nenhuma mensagem ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Usuários -------------------------------- */

function UsersTab() {
  const { toast } = useApp();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.users({ q, role, status, page });
      setRows(res.users);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(errMsg(err, 'Não foi possível carregar usuários.'));
    } finally {
      setLoading(false);
    }
  }, [q, role, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (u: AdminUser, body: Record<string, unknown>) => {
    try {
      await adminApi.updateUser(u.id, body);
      toast('Usuário atualizado.', 'success');
      void load();
    } catch (err) {
      toast(errMsg(err, 'Não foi possível atualizar.'), 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Pesquisar por nome, usuário ou e-mail"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <select className="select" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">Todas as permissões</option>
          <option value="member">Membros</option>
          <option value="moderator">Moderadores</option>
          <option value="admin">Administradores</option>
        </select>
        <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="suspended">Suspensos</option>
        </select>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {loading ? <LoadingBlock label="Carregando usuários…" /> : null}

      {!loading && rows.length === 0 ? <EmptyState title="Nenhum usuário encontrado" /> : null}

      {!loading && rows.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Membro</th>
                <th>E-mail</th>
                <th>Permissão</th>
                <th>Status</th>
                <th>Cadastro</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="row" style={{ gap: 9 }}>
                      <Avatar name={u.display_name} size="xs" />
                      <div>
                        <div className="small">{u.display_name}</div>
                        <div className="tiny text-muted">@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="tiny">{u.email}</td>
                  <td>
                    <select
                      className="select select-sm"
                      value={u.role}
                      onChange={(e) => void update(u, { role: e.target.value })}
                    >
                      <option value="member">Membro</option>
                      <option value="moderator">Moderador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td>
                    <span className="badge">{u.status === 'active' ? 'Ativo' : 'Suspenso'}</span>
                  </td>
                  <td className="tiny text-muted">{formatDate(u.created_at)}</td>
                  <td>
                    <button
                      className="mini-btn"
                      onClick={() => void update(u, { status: u.status === 'active' ? 'suspended' : 'active' })}
                    >
                      {u.status === 'active' ? 'Suspender' : 'Reativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {totalPages > 1 ? (
        <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <span className="tiny text-muted">Página {page} de {totalPages}</span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------- Conteúdos ------------------------------- */

const emptyPost = {
  title: '',
  description: '',
  body: '',
  categoryId: '',
  imageUrl: '',
  accessUrl: '',
  featured: false,
  status: 'published',
};

function PostsTab() {
  const { toast, isAdmin } = useApp();
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [form, setForm] = useState({ ...emptyPost });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([adminApi.posts({ q }), adminApi.categories()]);
      setPosts(p.posts);
      setCategories(c.categories);
    } catch (err) {
      setError(errMsg(err, 'Não foi possível carregar conteúdos.'));
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyPost, categoryId: categories[0] ? String(categories[0].id) : '' });
    setOpen(true);
  };

  const openEdit = (p: Post) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description,
      body: p.body || '',
      categoryId: String(p.category_id ?? ''),
      imageUrl: p.image_url || p.imageUrl || '',
      accessUrl: p.access_url || p.accessUrl || '',
      featured: Boolean(p.featured),
      status: p.status || 'published',
    });
    setOpen(true);
  };

  const pickImage = (file: File | null) => {
    if (!file) return;
    if (file.size > 600 * 1024) {
      toast('Imagem muito grande. Use até 600 KB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, imageUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        body: form.body,
        categoryId: Number(form.categoryId),
        imageUrl: form.imageUrl || null,
        accessUrl: form.accessUrl || null,
        featured: form.featured,
        status: form.status,
      };
      if (editing) await adminApi.updatePost(editing.id, payload);
      else await adminApi.createPost(payload);
      toast(editing ? 'Publicação atualizada.' : 'Publicação criada.', 'success');
      setOpen(false);
      void load();
    } catch (err) {
      toast(errMsg(err, 'Não foi possível salvar.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: Post) => {
    if (!confirm(`Excluir "${p.title}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await adminApi.deletePost(p.id);
      toast('Publicação excluída.', 'success');
      void load();
    } catch (err) {
      toast(errMsg(err, 'Não foi possível excluir.'), 'error');
    }
  };

  const toggleFeatured = async (p: Post) => {
    try {
      await adminApi.updatePost(p.id, { featured: !p.featured });
      void load();
    } catch (err) {
      toast(errMsg(err, 'Não foi possível destacar.'), 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Pesquisar publicações"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" onClick={openCreate}>Nova publicação</button>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {loading ? <LoadingBlock label="Carregando conteúdos…" /> : null}
      {!loading && !posts.length ? <EmptyState title="Nenhuma publicação" description="Crie a primeira publicação da biblioteca." /> : null}

      {!loading && posts.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Publicação</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Views</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <img
                        src={postImage(p) || ''}
                        alt=""
                        style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div className="small">{p.title}</div>
                        <div className="tiny text-muted">{formatDate(p.created_at || p.createdAt || '')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="tiny">{categoryName(p)}</td>
                  <td>
                    <span className="badge">{p.status === 'draft' ? 'Rascunho' : 'Publicado'}</span>
                  </td>
                  <td className="tiny">{numberFmt(p.views || 0)}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="mini-btn" onClick={() => openEdit(p)}>Editar</button>
                      <button className="mini-btn" onClick={() => void toggleFeatured(p)}>
                        {p.featured ? 'Remover destaque' : 'Destacar'}
                      </button>
                      {isAdmin ? (
                        <button className="mini-btn" onClick={() => void remove(p)}>Excluir</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal
        open={open}
        large
        title={editing ? 'Editar publicação' : 'Nova publicação'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => void save()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="grid-2">
          <div className="field">
            <label>Título</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <label>Categoria</label>
            <select
              className="select"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">Selecione</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Descrição curta</label>
          <textarea
            className="textarea"
            rows={2}
            maxLength={300}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Conteúdo completo</label>
          <textarea
            className="textarea"
            rows={8}
            maxLength={20000}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>

        <div className="grid-2">
          <div className="field">
            <label>Link de acesso</label>
            <input
              className="input"
              placeholder="https://…"
              value={form.accessUrl}
              onChange={(e) => setForm({ ...form, accessUrl: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Imagem (URL ou arquivo até 600 KB)</label>
            <input
              className="input"
              placeholder="https://…"
              value={form.imageUrl.startsWith('data:') ? '(arquivo selecionado)' : form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={(e) => pickImage(e.target.files?.[0] || null)}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              Escolher arquivo
            </button>
          </div>
        </div>

        <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            />
            <span className="small">Destacar na homepage</span>
          </label>
          <label className="row" style={{ gap: 8 }}>
            <span className="small">Status</span>
            <select
              className="select select-sm"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="published">Publicado</option>
              <option value="draft">Rascunho</option>
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------- Categorias ------------------------------- */

function CategoriesTab() {
  const { toast, isAdmin } = useApp();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('99');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.categories();
      setRows(res.categories);
    } catch (err) {
      toast(errMsg(err, 'Não foi possível carregar categorias.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    try {
      if (editing) await adminApi.updateCategory(editing.id, { name, description });
      else await adminApi.createCategory({ name, description, sortOrder: Number(sortOrder) || 99 });
      toast(editing ? 'Categoria atualizada.' : 'Categoria criada.', 'success');
      setOpen(false);
      void load();
    } catch (err) {
      toast(errMsg(err, 'Não foi possível salvar.'), 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <p className="small text-muted">Organize a biblioteca em categorias claras.</p>
        {isAdmin ? (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setEditing(null); setName(''); setDescription(''); setSortOrder('99'); setOpen(true); }}
          >
            Nova categoria
          </button>
        ) : null}
      </div>

      {loading ? <LoadingBlock label="Carregando categorias…" /> : null}

      {!loading ? (
        <div className="grid-cards">
          {rows.map((c) => (
            <div key={c.id} className="glass-panel" style={{ padding: 16 }}>
              <div className="row between">
                <strong className="small">{c.name}</strong>
                <span className="badge">{c.total ?? 0}</span>
              </div>
              <p className="tiny text-muted" style={{ marginTop: 6 }}>{c.description || 'Sem descrição'}</p>
              {isAdmin ? (
                <div className="row" style={{ gap: 4, marginTop: 10 }}>
                  <button
                    className="mini-btn"
                    onClick={() => { setEditing(c); setName(c.name); setDescription(c.description || ''); setOpen(true); }}
                  >
                    Editar
                  </button>
                  <button
                    className="mini-btn"
                    onClick={async () => {
                      if (!confirm(`Excluir a categoria ${c.name}?`)) return;
                      try {
                        await adminApi.deleteCategory(c.id);
                        toast('Categoria excluída.', 'success');
                        void load();
                      } catch (err) {
                        toast(errMsg(err, 'Não foi possível excluir.'), 'error');
                      }
                    }}
                  >
                    Excluir
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <Modal
        open={open}
        title={editing ? 'Editar categoria' : 'Nova categoria'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={() => void save()}>Salvar</button>
          </>
        }
      >
        <div className="field">
          <label>Nome</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </div>
        <div className="field">
          <label>Descrição</label>
          <textarea
            className="textarea"
            rows={3}
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {!editing ? (
          <div className="field">
            <label>Ordem</label>
            <input className="input" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* --------------------------------- Avisos --------------------------------- */

function AnnouncementsTab() {
  const { toast, isAdmin } = useApp();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({ title: '', body: '', level: 'info', active: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.announcements();
      setRows(res.announcements);
    } catch (err) {
      toast(errMsg(err, 'Não foi possível carregar avisos.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    try {
      const payload = { title: form.title, body: form.body, level: form.level, active: form.active };
      if (editing) await adminApi.updateAnnouncement(editing.id, payload);
      else await adminApi.createAnnouncement(payload);
      toast(editing ? 'Aviso atualizado.' : 'Aviso publicado.', 'success');
      setOpen(false);
      void load();
    } catch (err) {
      toast(errMsg(err, 'Não foi possível salvar.'), 'error');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <p className="small text-muted">Comunicados aparecem na homepage e no painel dos membros.</p>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setEditing(null); setForm({ title: '', body: '', level: 'info', active: true }); setOpen(true); }}
        >
          Novo aviso
        </button>
      </div>

      {loading ? <LoadingBlock label="Carregando avisos…" /> : null}
      {!loading && !rows.length ? <EmptyState title="Nenhum aviso publicado" /> : null}

      {!loading && rows.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((a) => (
            <div key={a.id} className="glass-panel" style={{ padding: 16 }}>
              <div className="row between" style={{ gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <strong className="small">{a.title}</strong>
                  <p className="tiny text-muted" style={{ marginTop: 4 }}>
                    {a.level.toUpperCase()} · {formatDate(a.created_at || a.createdAt || '')}
                  </p>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button
                    className="mini-btn"
                    onClick={() => { setEditing(a); setForm({ title: a.title, body: a.body, level: a.level, active: true }); setOpen(true); }}
                  >
                    Editar
                  </button>
                  {isAdmin ? (
                    <button
                      className="mini-btn"
                      onClick={async () => {
                        if (!confirm('Excluir este aviso?')) return;
                        try {
                          await adminApi.deleteAnnouncement(a.id);
                          toast('Aviso excluído.', 'success');
                          void load();
                        } catch (err) {
                          toast(errMsg(err, 'Não foi possível excluir.'), 'error');
                        }
                      }}
                    >
                      Excluir
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="small" style={{ marginTop: 8, color: 'var(--muted)' }}>{a.body}</p>
            </div>
          ))}
        </div>
      ) : null}

      <Modal
        open={open}
        title={editing ? 'Editar aviso' : 'Novo aviso'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={() => void save()}>Salvar</button>
          </>
        }
      >
        <div className="field">
          <label>Título</label>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="field">
          <label>Mensagem</label>
          <textarea
            className="textarea"
            rows={5}
            maxLength={2000}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Nível</label>
          <select className="select" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>
            <option value="info">Informativo</option>
            <option value="warning">Atenção</option>
            <option value="critical">Crítico</option>
          </select>
        </div>
      </Modal>
    </div>
  );
}

/* -------------------------------- Comunidade ------------------------------ */

function CommunityTab() {
  const { toast } = useApp();
  const [data, setData] = useState<ModerationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState('');
  const [muteTarget, setMuteTarget] = useState<{ id: number; name: string } | null>(null);
  const [minutes, setMinutes] = useState('30');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await communityApi.moderation();
      setData(res);
      setRules(res.rules);
    } catch (err) {
      toast(errMsg(err, 'Não foi possível carregar a moderação.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingBlock label="Carregando moderação…" />;
  if (!data) return <EmptyState title="Sem dados de moderação" />;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="glass-panel" style={{ padding: 18 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <strong className="small">Chat da comunidade</strong>
            <p className="tiny text-muted">
              {data.enabled ? 'Envio de mensagens liberado.' : 'Envio de mensagens desativado.'} · {data.online.length} online
            </p>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              try {
                await communityApi.setChatEnabled(!data.enabled);
                toast(data.enabled ? 'Chat desativado.' : 'Chat ativado.', 'success');
                void load();
              } catch (err) {
                toast(errMsg(err, 'Não foi possível alterar.'), 'error');
              }
            }}
          >
            {data.enabled ? 'Desativar chat' : 'Ativar chat'}
          </button>
        </div>
      </div>

      <div className="grid-2">
        <div className="glass-panel" style={{ padding: 18 }}>
          <strong className="small">Denúncias</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {data.reports.length ? (
              data.reports.map((r) => (
                <div key={r.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">{r.reason}</div>
                    <div className="s">
                      {r.reporter || 'membro'} · {r.message_author ? `autor: ${r.message_author}` : 'conteúdo'} ·{' '}
                      {timeAgo(r.created_at)}
                    </div>
                    {r.message_body ? (
                      <p className="tiny text-muted" style={{ marginTop: 4 }}>“{r.message_body}”</p>
                    ) : null}
                    <div className="row" style={{ gap: 4, marginTop: 6 }}>
                      <button
                        className="mini-btn"
                        onClick={async () => {
                          try {
                            await communityApi.resolveReport(r.id, 'resolved');
                            toast('Denúncia resolvida.', 'success');
                            void load();
                          } catch (err) {
                            toast(errMsg(err, 'Não foi possível resolver.'), 'error');
                          }
                        }}
                      >
                        Resolver
                      </button>
                      <button
                        className="mini-btn"
                        onClick={async () => {
                          try {
                            await communityApi.resolveReport(r.id, 'dismissed');
                            toast('Denúncia arquivada.', 'success');
                            void load();
                          } catch (err) {
                            toast(errMsg(err, 'Não foi possível arquivar.'), 'error');
                          }
                        }}
                      >
                        Arquivar
                      </button>
                      {r.message_id ? (
                        <button
                          className="mini-btn"
                          onClick={async () => {
                            try {
                              await adminApi.deleteMessage(Number(r.message_id));
                              toast('Mensagem removida.', 'success');
                              void load();
                            } catch (err) {
                              toast(errMsg(err, 'Não foi possível remover.'), 'error');
                            }
                          }}
                        >
                          Apagar mensagem
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="tiny text-muted">Nenhuma denúncia pendente.</p>
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 18 }}>
          <strong className="small">Silenciamentos ativos</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {data.mutes.length ? (
              data.mutes.map((m) => (
                <div key={m.id} className="list-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">{m.display_name || `Usuário #${m.user_id}`}</div>
                    <div className="s">até {formatDateTime(m.muted_until)} · {m.reason || 'sem motivo'}</div>
                  </div>
                  <button
                    className="mini-btn"
                    onClick={async () => {
                      try {
                        await communityApi.unmute(m.user_id);
                        toast('Silenciamento removido.', 'success');
                        void load();
                      } catch (err) {
                        toast(errMsg(err, 'Não foi possível remover.'), 'error');
                      }
                    }}
                  >
                    Remover
                  </button>
                </div>
              ))
            ) : (
              <p className="tiny text-muted">Nenhum membro silenciado.</p>
            )}
          </div>

          <strong className="small" style={{ display: 'block', marginTop: 18 }}>Membros online</strong>
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            {data.online.length ? (
              data.online.map((m) => (
                <div key={m.id} className="list-row">
                  <Avatar name={m.name || m.displayName || m.username} src={m.avatar} size="xs" />
                  <span className="small" style={{ flex: 1 }}>{m.name || m.displayName || m.username}</span>
                  <RoleBadge role={m.role} />
                  <button
                    className="mini-btn"
                    onClick={() => { setMuteTarget({ id: m.id, name: m.name || m.displayName || m.username }); setReason(''); }}
                  >
                    Silenciar
                  </button>
                </div>
              ))
            ) : (
              <p className="tiny text-muted">Ninguém online agora.</p>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 18 }}>
        <strong className="small">Regras de convivência</strong>
        <textarea
          className="textarea"
          rows={5}
          maxLength={4000}
          style={{ marginTop: 10 }}
          value={rules}
          onChange={(e) => setRules(e.target.value)}
        />
        <button
          className="btn btn-primary btn-sm"
          style={{ marginTop: 10 }}
          onClick={async () => {
            try {
              await adminApi.saveSettings({ community_rules: rules });
              toast('Regras atualizadas.', 'success');
            } catch (err) {
              toast(errMsg(err, 'Não foi possível salvar.'), 'error');
            }
          }}
        >
          Salvar regras
        </button>
      </div>

      <Modal
        open={Boolean(muteTarget)}
        title={`Silenciar ${muteTarget?.name || ''}`}
        onClose={() => setMuteTarget(null)}
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setMuteTarget(null)}>Cancelar</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={async () => {
                if (!muteTarget) return;
                try {
                  await communityApi.mute(muteTarget.id, Number(minutes) || 30, reason || 'Conduta inadequada');
                  toast('Membro silenciado.', 'success');
                  setMuteTarget(null);
                  void load();
                } catch (err) {
                  toast(errMsg(err, 'Não foi possível silenciar.'), 'error');
                }
              }}
            >
              Silenciar
            </button>
          </>
        }
      >
        <div className="field">
          <label>Duração (minutos)</label>
          <input className="input" type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
        <div className="field">
          <label>Motivo</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------ Configurações ----------------------------- */

const SETTING_FIELDS: { key: string; label: string; type: 'text' | 'textarea' | 'number' }[] = [
  { key: 'site_name', label: 'Nome do site', type: 'text' },
  { key: 'site_tagline', label: 'Assinatura / slogan', type: 'text' },
  { key: 'site_description', label: 'Descrição', type: 'textarea' },
  { key: 'logo_text', label: 'Texto do logotipo', type: 'text' },
  { key: 'discord_url', label: 'Convite do Discord', type: 'text' },
  { key: 'ai_model', label: 'Modelo da 22M AI', type: 'text' },
  { key: 'ai_daily_limit', label: 'Limite diário de mensagens por membro', type: 'number' },
  { key: 'ai_system_prompt', label: 'Personalidade da 22M AI', type: 'textarea' },
  { key: 'effects_default', label: 'Efeitos padrão', type: 'text' },
];

function SettingsTab({ isAdmin }: { isAdmin: boolean }) {
  const { toast, refreshSettings } = useApp();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .settings()
      .then((res) => {
        setValues({ ...(res.settings as SiteSettings) });
        setAiConfigured(res.aiConfigured);
      })
      .catch((err) => toast(errMsg(err, 'Não foi possível carregar as configurações.'), 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  if (!isAdmin) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Apenas administradores podem alterar as configurações da plataforma."
      />
    );
  }

  if (loading) return <LoadingBlock label="Carregando configurações…" />;

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.saveSettings(values);
      await refreshSettings();
      toast('Configurações salvas.', 'success');
    } catch (err) {
      toast(errMsg(err, 'Não foi possível salvar.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const testAi = async () => {
    setTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await adminApi.aiTest();
      setAiTestResult(`Conexão OK — ${res.provider} · ${res.model} · ${res.latencyMs} ms`);
      toast('Conexão com o provedor de IA funcionando.', 'success');
    } catch (err) {
      const message = errMsg(err, 'Não foi possível testar a conexão com a IA.');
      setAiTestResult(message);
      toast(message, 'error');
    } finally {
      setTestingAi(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="glass-panel" style={{ padding: 18 }}>
        <div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div>
            <strong className="small">22M AI</strong>
            <p className="tiny text-muted">
              {aiConfigured
                ? 'Provedor de IA configurado via variável de ambiente.'
                : 'Nenhuma chave de IA configurada. Defina AI_API_KEY ou OPENAI_API_KEY nas variáveis de ambiente.'}
            </p>
          </div>
          <span className="badge">{aiConfigured ? 'Conectada' : 'Pendente'}</span>
        </div>
        <p className="tiny text-muted" style={{ marginTop: 10 }}>
          A chave nunca é exposta ao navegador: todas as chamadas passam pelo backend com limites por membro.
        </p>
        <div className="row" style={{ gap: 12, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-ghost" type="button" onClick={testAi} disabled={testingAi || !aiConfigured}>
            {testingAi ? 'Testando…' : 'Testar conexão'}
          </button>
          {aiTestResult ? <span className="tiny text-muted">{aiTestResult}</span> : null}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 18, display: 'grid', gap: 14 }}>
        {SETTING_FIELDS.map((f) => (
          <div key={f.key} className="field">
            <label>{f.label}</label>
            {f.type === 'textarea' ? (
              <textarea
                className="textarea"
                rows={3}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            ) : (
              <input
                className="input"
                type={f.type}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            )}
          </div>
        ))}

        <div className="row" style={{ gap: 20, flexWrap: 'wrap' }}>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={values.community_enabled === '1'}
              onChange={(e) => setValues({ ...values, community_enabled: e.target.checked ? '1' : '0' })}
            />
            <span className="small">Comunidade ativa</span>
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={values.ai_enabled === '1'}
              onChange={(e) => setValues({ ...values, ai_enabled: e.target.checked ? '1' : '0' })}
            />
            <span className="small">22M AI ativa</span>
          </label>
        </div>

        <button className="btn btn-primary" disabled={saving} onClick={() => void save()} style={{ justifySelf: 'start' }}>
          {saving ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- Logs ---------------------------------- */

function LogsTab({ isAdmin }: { isAdmin: boolean }) {
  const [logs, setLogs] = useState<DashboardData['logs']>([]);
  const [resets, setResets] = useState<{ id: number; display_name: string; created_at: string; used_at: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const l = await adminApi.logs();
        if (!alive) return;
        setLogs(l.logs);
        if (isAdmin) {
          const r = await adminApi.passwordResets();
          if (alive) setResets(r.resets);
        }
      } catch {
        /* silencioso: log é informativo */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  if (loading) return <LoadingBlock label="Carregando registros…" />;

  const rows = useMemo(() => logs, [logs]);

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="glass-panel" style={{ padding: 18 }}>
        <strong className="small">Histórico administrativo</strong>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {rows.length ? (
            rows.map((l) => (
              <div key={l.id} className="list-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">{l.action}</div>
                  <div className="s">
                    {l.actor || 'sistema'} · {l.target_type || '—'} {l.target_id ? `#${l.target_id}` : ''} ·{' '}
                    {l.details || '—'}
                  </div>
                </div>
                <span className="tiny text-muted">{formatDateTime(l.created_at)}</span>
              </div>
            ))
          ) : (
            <p className="tiny text-muted">Nenhum registro.</p>
          )}
        </div>
      </div>

      {isAdmin ? (
        <div className="glass-panel" style={{ padding: 18 }}>
          <strong className="small">Recuperações de senha</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {resets.length ? (
              resets.map((r) => (
                <div key={r.id} className="list-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t">{r.display_name}</div>
                    <div className="s">
                      solicitado {formatDateTime(r.created_at)} · {r.used_at ? 'utilizado' : 'pendente'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="tiny text-muted">Nenhuma solicitação registrada.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
