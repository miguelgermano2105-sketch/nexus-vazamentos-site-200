import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../lib/api';
import type { Overview } from '../lib/types';
import { useApp } from '../state/AppContext';
import { Avatar, EmptyState, LoadingBlock, PostCard, RoleBadge } from '../components/ui';
import { formatDate, formatDateTime, timeAgo } from '../lib/format';

export default function MemberPanel() {
  const { user, logout, isStaff, toast } = useApp();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await authApi.overview();
        if (alive) setData(res);
      } catch {
        if (alive) setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const markRead = async () => {
    try {
      await authApi.readNotifications();
      setData((d) =>
        d
          ? { ...d, counts: { ...d.counts, unread: 0 }, notifications: d.notifications.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })) }
          : d,
      );
      toast('Notificações marcadas como lidas.', 'success');
    } catch {
      toast('Não foi possível marcar as notificações.', 'error');
    }
  };

  if (loading) return <LoadingBlock label="Carregando painel…" />;
  if (!user) return null;

  const counts = data?.counts ?? { favorites: 0, history: 0, unread: 0, messages: 0 };

  return (
    <section className="section">
      <div className="container">
        <div className="panel-hero glass-panel">
          <Avatar name={user.displayName} src={user.avatar} size="xl" />
          <div className="stack" style={{ gap: 6, flex: 1, minWidth: 220 }}>
            <div className="row" style={{ gap: 8 }}>
              <h1 style={{ fontSize: 'clamp(24px, 4vw, 34px)' }}>Olá, {user.displayName}</h1>
              <RoleBadge role={user.role} />
            </div>
            <p className="small text-muted">
              @{user.username} · Membro desde {formatDate(user.createdAt)}
            </p>
            {user.bio ? <p className="small text-muted">{user.bio}</p> : null}
          </div>
          <div className="row" style={{ gap: 10 }}>
            <Link className="btn btn-ghost btn-sm" to="/perfil">Editar perfil</Link>
            <button className="btn btn-ghost btn-sm" onClick={() => void logout()}>Sair</button>
          </div>
        </div>

        <div className="stat-grid" style={{ marginTop: 22 }}>
          <div className="glass-panel stat-card">
            <span className="stat-label">Favoritos</span>
            <strong className="stat-value">{counts.favorites}</strong>
          </div>
          <div className="glass-panel stat-card">
            <span className="stat-label">Histórico</span>
            <strong className="stat-value">{counts.history}</strong>
          </div>
          <div className="glass-panel stat-card">
            <span className="stat-label">Notificações</span>
            <strong className="stat-value">{counts.unread}</strong>
          </div>
          <div className="glass-panel stat-card">
            <span className="stat-label">Mensagens no chat</span>
            <strong className="stat-value">{counts.messages}</strong>
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: 26 }}>
          <div className="stack" style={{ gap: 16 }}>
            <div className="row between">
              <h2 className="section-title" style={{ fontSize: 22 }}>Favoritos</h2>
              <Link to="/conteudos" className="tiny text-muted">Ver biblioteca</Link>
            </div>
            {data?.favorites?.length ? (
              <div className="grid grid-2">
                {data.favorites.slice(0, 4).map((post) => (
                  <PostCard key={post.id} post={post} compact />
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum favorito ainda" description="Favorite conteúdos para encontrá-los rapidamente aqui." />
            )}

            <div className="row between" style={{ marginTop: 10 }}>
              <h2 className="section-title" style={{ fontSize: 22 }}>Histórico de visualização</h2>
            </div>
            {data?.history?.length ? (
              <div className="glass-panel card-pad stack" style={{ gap: 10 }}>
                {data.history.slice(0, 8).map((post) => (
                  <Link key={post.id} to={`/conteudos/${post.slug}`} className="row between history-row">
                    <span className="small">{post.title}</span>
                    <span className="tiny text-muted">{timeAgo(post.created_at)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="Histórico vazio" description="Os conteúdos que você abrir aparecem aqui." />
            )}
          </div>

          <div className="stack" style={{ gap: 16 }}>
            <div className="row between">
              <h2 className="section-title" style={{ fontSize: 22 }}>Notificações</h2>
              {counts.unread > 0 ? (
                <button className="tiny text-muted link-btn" onClick={() => void markRead()}>Marcar como lidas</button>
              ) : null}
            </div>
            {data?.notifications?.length ? (
              <div className="glass-panel card-pad stack" style={{ gap: 12 }}>
                {data.notifications.slice(0, 8).map((n) => (
                  <div key={n.id} className={`notice${n.read_at ? '' : ' unread'}`}>
                    <div className="row between">
                      <strong className="small">{n.title}</strong>
                      <span className="tiny text-muted">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="tiny text-muted" style={{ marginTop: 4 }}>{n.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Sem notificações" description="Você receberá avisos da equipe aqui." />
            )}

            <h2 className="section-title" style={{ fontSize: 22, marginTop: 8 }}>Comunicados</h2>
            {data?.announcements?.length ? (
              <div className="stack" style={{ gap: 10 }}>
                {data.announcements.slice(0, 4).map((a) => (
                  <div key={a.id} className={`banner-note${a.level === 'critical' ? ' critical' : ''}`}>
                    <strong className="small">{a.title}</strong>
                    <p className="tiny" style={{ marginTop: 4 }}>{a.body}</p>
                    <span className="tiny text-muted">{formatDateTime(a.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nenhum comunicado" description="Avisos oficiais da plataforma aparecerão aqui." />
            )}

            <div className="glass-panel card-pad stack" style={{ gap: 10, marginTop: 8 }}>
              <h3 className="card-title" style={{ fontSize: 16 }}>Atalhos</h3>
              <div className="row wrap" style={{ gap: 8 }}>
                <Link to="/nexus-ai" className="btn btn-ghost btn-sm">NEXUS AI</Link>
                <Link to="/comunidade" className="btn btn-ghost btn-sm">Comunidade</Link>
                <Link to="/configuracoes" className="btn btn-ghost btn-sm">Configurações</Link>
                {isStaff ? <Link to="/moderacao" className="btn btn-ghost btn-sm">Moderação</Link> : null}
                {isStaff ? <Link to="/admin" className="btn btn-ghost btn-sm">Admin</Link> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
