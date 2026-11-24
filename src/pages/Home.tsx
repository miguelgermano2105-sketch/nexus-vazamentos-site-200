import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { contentApi } from '../lib/api';
import type { HomeData } from '../lib/types';
import { useApp } from '../state/AppContext';
import { DiscordButton } from '../components/Footer';
import { EmptyState, LevelBadge, LoadingBlock, PostCard, Reveal, SkeletonCards } from '../components/ui';
import { formatDate, numberFmt } from '../lib/format';

export default function Home() {
  const { settings, user } = useApp();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    contentApi
      .home()
      .then((res) => alive && setData(res))
      .catch(() => alive && setError('Não foi possível carregar a página inicial. Tente novamente.'));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-orb" aria-hidden />
          <div className="hero-ring r1" aria-hidden />
          <div className="hero-ring r2" aria-hidden />
          <span className="hero-badge">Plataforma digital premium</span>
          <h1 className="hero-title">
            NEXUS <span className="text-dim">VAZAMENTOS</span>
          </h1>
          <p className="hero-sub">
            Conteúdos selecionados, comunidade em tempo real e inteligência artificial própria em uma única
            experiência black &amp; white. Tecnologia, curadoria e design premium.
          </p>
          <div className="hero-actions">
            <Link to="/conteudos" className="btn btn-primary btn-lg">Explorar conteúdos</Link>
            <Link to="/comunidade" className="btn btn-ghost btn-lg">Entrar na comunidade</Link>
          </div>
          <div className="hero-actions" style={{ marginTop: 14 }}>
            <DiscordButton small />
          </div>

          <div className="hero-stats">
            <div className="hero-stat">
              <strong>{numberFmt(data?.stats.posts)}</strong>
              <span>Publicações</span>
            </div>
            <div className="hero-stat">
              <strong>{numberFmt(data?.stats.members)}</strong>
              <span>Membros</span>
            </div>
            <div className="hero-stat">
              <strong>{numberFmt(data?.stats.categories)}</strong>
              <span>Categorias</span>
            </div>
            <div className="hero-stat">
              <strong>{numberFmt(data?.stats.messages)}</strong>
              <span>Mensagens</span>
            </div>
          </div>
        </div>
      </section>

      {data?.announcements?.length ? (
        <section className="section-sm">
          <div className="container">
            <div className="stack">
              {data.announcements.slice(0, 3).map((a) => (
                <div key={a.id} className={`banner-note${a.level === 'critical' ? ' critical' : ''}`}>
                  <div className="row between wrap gap-8">
                    <strong>{a.title}</strong>
                    <LevelBadge level={a.level} />
                  </div>
                  <p className="small text-muted" style={{ marginTop: 6 }}>{a.body}</p>
                  <span className="tiny text-dim">{formatDate(a.created_at || a.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow"><span className="dot" /> Curadoria</div>
              <h2 className="section-title">Conteúdos em destaque</h2>
              <p className="section-desc">Seleção editorial da plataforma, revisada e organizada por categoria.</p>
            </div>
            <Link to="/conteudos" className="btn btn-ghost btn-sm">Ver todos</Link>
          </div>
          {error ? <EmptyState title="Falha ao carregar" description={error} /> : null}
          {!data && !error ? <SkeletonCards /> : null}
          {data && data.featured.length === 0 ? (
            <EmptyState title="Nenhum destaque ainda" description="A equipe está preparando a primeira seleção de conteúdos." />
          ) : null}
          {data && data.featured.length > 0 ? (
            <div className="grid-cards">
              {data.featured.map((post, i) => (
                <Reveal key={post.id} delay={i * 45}>
                  <PostCard post={post} />
                </Reveal>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section-sm">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow"><span className="dot" /> Navegue</div>
              <h2 className="section-title">Categorias disponíveis</h2>
            </div>
          </div>
          <div className="feature-grid">
            {(data?.categories || []).map((cat, i) => (
              <Reveal key={cat.id} delay={i * 35}>
                <Link to={`/conteudos?categoria=${cat.slug}`} className="feature">
                  <span className="feature-icon">{cat.name.slice(0, 1)}</span>
                  <h4>{cat.name}</h4>
                  <p>{cat.description || 'Conteúdos selecionados desta categoria.'}</p>
                  <span className="tiny text-dim">{numberFmt(cat.total)} publicações</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="eyebrow"><span className="dot" /> Atualizações</div>
              <h2 className="section-title">Publicações recentes</h2>
            </div>
            <Link to="/conteudos?ordenar=recentes" className="btn btn-ghost btn-sm">Ver biblioteca</Link>
          </div>
          {!data ? <SkeletonCards count={3} /> : null}
          {data && data.recent.length === 0 ? (
            <EmptyState title="Biblioteca em preparação" description="Novas publicações aparecerão aqui." />
          ) : null}
          <div className="grid-cards">
            {(data?.recent || []).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </section>

      <section className="section-sm">
        <div className="container">
          <div className="dash-grid">
            <div className="glass-panel card-pad">
              <div className="eyebrow"><span className="dot" /> Inteligência artificial</div>
              <h3 className="section-title" style={{ fontSize: 26 }}>NEXUS AI</h3>
              <p className="text-muted small" style={{ marginTop: 10 }}>
                Uma assistente treinada para conhecer a plataforma: encontra conteúdos, explica tutoriais, gera
                ideias e organiza textos. Conversas salvas para membros autenticados.
              </p>
              <div className="hero-actions" style={{ marginTop: 20 }}>
                <Link to="/nexus-ai" className="btn btn-primary">Conversar com a NEXUS AI</Link>
              </div>
            </div>
            <div className="glass-panel card-pad">
              <div className="eyebrow"><span className="dot" /> Tempo real</div>
              <h3 className="section-title" style={{ fontSize: 26 }}>NEXUS Community</h3>
              <p className="text-muted small" style={{ marginTop: 10 }}>
                Chat público integrado, com membros online, respostas, emojis e moderação ativa. Entre na
                comunidade e converse com outros membros em tempo real.
              </p>
              <div className="hero-actions" style={{ marginTop: 20 }}>
                <Link to="/comunidade" className="btn btn-primary">Abrir comunidade</Link>
                <DiscordButton small />
              </div>
            </div>
          </div>
        </div>
      </section>

      {!user ? (
        <section className="section">
          <div className="container">
            <div className="community-cta">
              <div>
                <div className="eyebrow"><span className="dot" /> Acesso completo</div>
                <h2 className="section-title" style={{ fontSize: 32 }}>Crie sua conta gratuita</h2>
                <p className="section-desc">
                  Favoritos, histórico, notificações, histórico de IA e participação na comunidade — tudo
                  sincronizado na sua conta.
                </p>
              </div>
              <div className="hero-actions">
                <Link to="/criar-conta" className="btn btn-primary btn-lg">Criar conta</Link>
                <Link to="/entrar" className="btn btn-ghost btn-lg">Já tenho conta</Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="section-sm">
        <div className="container text-center">
          <span className="signature">{settings.siteName} — DESENVOLVIDO POR SILVA</span>
        </div>
      </section>
    </>
  );
}
