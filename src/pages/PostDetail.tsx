import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, contentApi } from '../lib/api';
import type { Post } from '../lib/types';
import { useApp } from '../state/AppContext';
import { Avatar, EmptyState, LoadingBlock, Modal, PostCard } from '../components/ui';
import { categoryName, formatDate, numberFmt, postAccessUrl, postImage } from '../lib/format';

export default function PostDetail() {
  const { slug = '' } = useParams();
  const { user, favoriteIds, toggleFavorite, toast } = useApp();
  const [post, setPost] = useState<Post | null>(null);
  const [related, setRelated] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    contentApi
      .post(slug)
      .then((res) => {
        if (!alive) return;
        setPost(res.post);
        setRelated(res.related || []);
      })
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : 'Conteúdo não encontrado.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  const submitReport = async () => {
    if (!post) return;
    if (reason.trim().length < 5) {
      toast('Descreva o motivo com pelo menos 5 caracteres.', 'error');
      return;
    }
    try {
      await contentApi.reportContent(post.id, reason.trim());
      toast('Denúncia registrada. Nossa equipe irá analisar.', 'success');
      setReportOpen(false);
      setReason('');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Não foi possível enviar a denúncia.', 'error');
    }
  };

  if (loading) {
    return (
      <section className="section">
        <div className="container container-narrow">
          <LoadingBlock label="Carregando conteúdo…" />
        </div>
      </section>
    );
  }

  if (error || !post) {
    return (
      <section className="section">
        <div className="container container-narrow">
          <EmptyState
            icon="✕"
            title="Conteúdo indisponível"
            description={error || 'Este conteúdo não existe ou foi removido.'}
            action={<Link to="/conteudos" className="btn btn-primary">Voltar à biblioteca</Link>}
          />
        </div>
      </section>
    );
  }

  const img = postImage(post);
  const access = postAccessUrl(post);
  const isFav = favoriteIds.includes(post.id);

  return (
    <article className="section">
      <div className="container container-narrow">
        <div className="row between wrap gap-8" style={{ marginBottom: 18 }}>
          <Link to="/conteudos" className="btn btn-ghost btn-sm">← Biblioteca</Link>
          <div className="row gap-8 wrap">
            <button className={`btn btn-sm ${isFav ? 'btn-primary' : 'btn-ghost'}`} onClick={() => void toggleFavorite(post.id)}>
              {isFav ? '★ Favoritado' : '☆ Favoritar'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setReportOpen(true)}>Denunciar</button>
          </div>
        </div>

        <div className="post-hero">
          {img ? <img src={img} alt="" className="post-hero-img" /> : <div className="post-hero-fallback">{post.title.slice(0, 1)}</div>}
        </div>

        <div className="row gap-8 wrap" style={{ marginTop: 22 }}>
          <span className="chip chip-solid">{categoryName(post)}</span>
          {post.featured ? <span className="chip">Destaque</span> : null}
          <span className="tiny text-dim">{formatDate(post.created_at || post.createdAt)}</span>
          <span className="tiny text-dim">{numberFmt(post.views)} visualizações</span>
        </div>

        <h1 className="section-title" style={{ fontSize: 'clamp(28px, 5vw, 44px)', marginTop: 14 }}>{post.title}</h1>
        <p className="section-desc" style={{ fontSize: 17 }}>{post.description}</p>

        <div className="prose-card">
          {(post.body || '').split(/\n{2,}/).map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          {!post.body ? <p className="text-muted">Conteúdo completo disponível no botão de acesso.</p> : null}
        </div>

        <div className="glass-panel card-pad" style={{ marginTop: 24 }}>
          <div className="row between wrap gap-20">
            <div>
              <strong>Acesso ao conteúdo</strong>
              <p className="small text-muted" style={{ marginTop: 6 }}>
                Conteúdo autorizado, legal e que respeita direitos de terceiros. Links externos abrem em nova aba.
              </p>
            </div>
            <div className="row gap-8 wrap">
              {access ? (
                <a className="btn btn-primary" href={access} target="_blank" rel="noopener noreferrer">
                  Acessar conteúdo
                </a>
              ) : (
                <span className="chip">Disponível na plataforma</span>
              )}
              {!user ? <Link to="/entrar" className="btn btn-ghost">Entrar para salvar</Link> : null}
            </div>
          </div>
        </div>

        {related.length ? (
          <div style={{ marginTop: 46 }}>
            <div className="section-head">
              <div>
                <div className="eyebrow"><span className="dot" /> Relacionados</div>
                <h2 className="section-title" style={{ fontSize: 26 }}>Você também pode gostar</h2>
              </div>
            </div>
            <div className="grid-cards">
              {related.map((r) => (
                <PostCard key={r.id} post={r} compact />
              ))}
            </div>
          </div>
        ) : null}

        <div className="row between wrap gap-8" style={{ marginTop: 40 }}>
          <div className="row gap-8">
            <Avatar name="SILVA" size="sm" />
            <span className="small text-muted">Curadoria 22M — <span className="signature">Desenvolvido por Silva</span></span>
          </div>
        </div>
      </div>

      <Modal
        open={reportOpen}
        title="Denunciar conteúdo"
        onClose={() => setReportOpen(false)}
        footer={
          <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setReportOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={submitReport}>Enviar denúncia</button>
          </div>
        }
      >
        <div className="field">
          <label className="label" htmlFor="report-reason">Motivo da denúncia</label>
          <textarea
            id="report-reason"
            className="textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Descreva o problema encontrado neste conteúdo…"
            maxLength={600}
          />
          <span className="hint">Denúncias são analisadas pela equipe de moderação.</span>
        </div>
      </Modal>
    </article>
  );
}
