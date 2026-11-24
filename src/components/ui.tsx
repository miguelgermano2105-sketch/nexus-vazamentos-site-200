import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import type { Post, Role } from '../lib/types';
import { categoryName, formatDate, initials, numberFmt, postImage, timeAgo } from '../lib/format';

/* --------------------------------- Avatar --------------------------------- */

export function Avatar({
  name,
  src,
  size = 'md',
  online,
}: {
  name?: string | null;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
}) {
  return (
    <span className={`avatar-wrap`}>
      <span className={`avatar avatar-${size}`}>{src ? <img src={src} alt={name || 'avatar'} /> : initials(name)}</span>
      {online ? <span className="presence-dot" aria-label="online" /> : null}
    </span>
  );
}

/* -------------------------------- Spinner --------------------------------- */

export function Spinner({ large }: { large?: boolean }) {
  return <span className={`spinner${large ? ' spinner-lg' : ''}`} role="status" aria-label="Carregando" />;
}

export function LoadingBlock({ label = 'Carregando conteúdo…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <Spinner large />
      <span className="small text-muted">{label}</span>
    </div>
  );
}

/* ------------------------------- EmptyState ------------------------------- */

export function EmptyState({
  icon = '◇',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="icon" aria-hidden>{icon}</span>
      <h4>{title}</h4>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

/* --------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  large,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  large?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${large ? ' modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3 style={{ fontSize: 17 }}>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* --------------------------------- Toasts --------------------------------- */

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismissToast(t.id)} role="status">
          <span style={{ flex: 1 }}>{t.message}</span>
          <span className="tiny" style={{ opacity: 0.6 }}>fechar</span>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Reveal ---------------------------------- */

export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setSeen(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [seen]);

  return (
    <div ref={ref} className={`reveal${seen ? ' in' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* -------------------------------- Badges ---------------------------------- */

export function RoleBadge({ role }: { role: Role }) {
  if (role === 'admin') return <span className="badge badge-admin">Admin</span>;
  if (role === 'moderator') return <span className="badge badge-mod">Moderador</span>;
  return null;
}

export function LevelBadge({ level }: { level: string }) {
  const label = level === 'critical' ? 'Importante' : level === 'warning' ? 'Atenção' : 'Aviso';
  return <span className={`badge${level === 'critical' ? ' badge-admin' : ''}`}>{label}</span>;
}

/* ------------------------------- PostCard --------------------------------- */

export function PostCard({ post, compact }: { post: Post; compact?: boolean }) {
  const { favoriteIds, toggleFavorite } = useApp();
  const isFav = favoriteIds.includes(post.id);
  const img = postImage(post);

  return (
    <article className="card card-hover post-card">
      <Link to={`/conteudos/${post.slug}`} className="post-media" aria-label={post.title}>
        {img ? <img src={img} alt="" loading="lazy" /> : <span className="glyph">{(post.title || 'N').slice(0, 1)}</span>}
      </Link>
      <button
        className={`fav-btn${isFav ? ' on' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          void toggleFavorite(post.id);
        }}
        aria-label={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      >
        {isFav ? '★' : '☆'}
      </button>
      <div className="post-body">
        <div className="row gap-8 wrap">
          <span className="chip">{categoryName(post)}</span>
          {post.featured ? <span className="chip chip-solid">Destaque</span> : null}
        </div>
        <h3 className="post-title">
          <Link to={`/conteudos/${post.slug}`}>{post.title}</Link>
        </h3>
        {!compact ? <p className="post-desc">{post.description}</p> : null}
        <div className="post-meta">
          <span>{formatDate(post.created_at || post.createdAt)}</span>
          <span>{numberFmt(post.views)} visualizações</span>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------- Pagination -------------------------------- */

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let i = start; i <= Math.min(totalPages, start + 4); i += 1) pages.push(i);

  return (
    <div className="pagination">
      <button className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</button>
      {start > 1 ? (
        <>
          <button className="page-btn" onClick={() => onChange(1)}>1</button>
          {start > 2 ? <span className="text-dim">…</span> : null}
        </>
      ) : null}
      {pages.map((p) => (
        <button key={p} className={`page-btn${p === page ? ' active' : ''}`} onClick={() => onChange(p)}>
          {p}
        </button>
      ))}
      {start + 4 < totalPages ? (
        <>
          <span className="text-dim">…</span>
          <button className="page-btn" onClick={() => onChange(totalPages)}>{totalPages}</button>
        </>
      ) : null}
      <button className="page-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}

/* ------------------------------ Error banner ------------------------------- */

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div className="form-error">{children}</div>;
}

/* ------------------------------ Page header -------------------------------- */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="section-head" style={{ alignItems: 'flex-start' }}>
      <div>
        {eyebrow ? <div className="eyebrow" style={{ marginBottom: 12 }}><span className="dot" />{eyebrow}</div> : null}
        <h1 className="section-title">{title}</h1>
        {description ? <p className="section-desc">{description}</p> : null}
      </div>
      {actions ? <div className="row gap-10 wrap">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------- Small bits -------------------------------- */

export function LiveBadge({ label = 'Ao vivo' }: { label?: string }) {
  return (
    <span className="badge badge-live">
      <span className="pulse" /> {label}
    </span>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid-cards">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ overflow: 'hidden' }}>
          <div className="skeleton" style={{ aspectRatio: '16 / 9' }} />
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="skeleton" style={{ height: 12, width: '40%' }} />
            <div className="skeleton" style={{ height: 16, width: '90%' }} />
            <div className="skeleton" style={{ height: 12, width: '70%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export const inlineStyles: Record<string, CSSProperties> = {};
