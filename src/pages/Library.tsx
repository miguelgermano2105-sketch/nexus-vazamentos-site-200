import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { contentApi } from '../lib/api';
import type { Category, Paginated, Post } from '../lib/types';
import { EmptyState, Pagination, PostCard, SkeletonCards } from '../components/ui';
import { cn } from '../lib/format';

const SORTS = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'antigos', label: 'Mais antigos' },
  { value: 'populares', label: 'Mais vistos' },
  { value: 'titulo', label: 'Título (A–Z)' },
];

export default function Library() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<Paginated<Post> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const search = params.get('busca') || '';
  const category = params.get('categoria') || '';
  const sort = params.get('ordenar') || 'recentes';
  const page = Number(params.get('pagina') || 1);

  const [term, setTerm] = useState(search);

  useEffect(() => {
    setTerm(search);
  }, [search]);

  useEffect(() => {
    contentApi.categories().then((r) => setCategories(r.categories)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (term !== search) {
        const next = new URLSearchParams(params);
        if (term) next.set('busca', term);
        else next.delete('busca');
        next.delete('pagina');
        setParams(next, { replace: true });
      }
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    contentApi
      .posts({ search: search || undefined, category: category || undefined, sort, page, perPage: 9 })
      .then((res) => {
        if (!alive) return;
        setResult(res);
      })
      .catch(() => alive && setError('Não foi possível carregar a biblioteca. Verifique sua conexão.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [search, category, sort, page]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'pagina') next.delete('pagina');
    setParams(next);
  };

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === category)?.name || 'Todos os conteúdos',
    [categories, category],
  );

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow"><span className="dot" /> Biblioteca</div>
            <h1 className="section-title">{activeCategory}</h1>
            <p className="section-desc">
              Conteúdos autorizados e organizados por categoria. Use a busca, filtros e ordenação para encontrar
              exatamente o que precisa.
            </p>
          </div>
          <span className="chip">{result ? `${result.total} resultados` : 'Carregando…'}</span>
        </div>

        <div className="library-toolbar">
          <div className="search-wrap">
            <input
              className="input"
              placeholder="Pesquisar por título, descrição ou conteúdo…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              aria-label="Pesquisar conteúdos"
            />
          </div>
          <select className="select" value={sort} onChange={(e) => setParam('ordenar', e.target.value)} aria-label="Ordenação">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="category-bar">
          <button
            className={cn('chip-button', !category && 'active')}
            onClick={() => setParam('categoria', '')}
          >
            Todas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={cn('chip-button', category === c.slug && 'active')}
              onClick={() => setParam('categoria', c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>

        {error ? <EmptyState title="Falha ao carregar" description={error} /> : null}
        {loading ? <SkeletonCards count={6} /> : null}
        {!loading && result && result.items.length === 0 ? (
          <EmptyState
            title="Nenhum conteúdo encontrado"
            description="Ajuste a busca ou selecione outra categoria."
          />
        ) : null}

        {!loading && result && result.items.length > 0 ? (
          <>
            <div className="grid-cards">
              {result.items.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              onChange={(p) => setParam('pagina', String(p))}
            />
          </>
        ) : null}
      </div>
    </section>
  );
}
