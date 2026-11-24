import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, authApi } from '../lib/api';
import { useApp } from '../state/AppContext';
import { ErrorNote, LoadingBlock } from '../components/ui';

/**
 * Primeiro acesso: cria a credencial administrativa inicial de forma segura.
 * Só funciona enquanto não existir nenhum administrador no banco.
 */
export default function Setup() {
  const { needsAdmin, user, refreshUser, toast, booting } = useApp();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('Silva');
  const [username, setUsername] = useState('silva');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!booting && !needsAdmin && user) navigate('/painel', { replace: true });
  }, [booting, needsAdmin, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 10) {
      setError('A senha administrativa deve ter pelo menos 10 caracteres.');
      return;
    }
    setBusy(true);
    try {
      await authApi.claimAdmin({ displayName, username, email, password });
      await refreshUser();
      toast('Credencial administrativa criada. Bem-vindo ao painel.', 'success');
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a credencial.');
    } finally {
      setBusy(false);
    }
  };

  if (booting) return <LoadingBlock label="Verificando plataforma…" />;

  if (!needsAdmin) {
    return (
      <section className="section">
        <div className="container container-narrow text-center">
          <h1 className="section-title">Plataforma já configurada</h1>
          <p className="section-sub">A credencial administrativa inicial já foi definida.</p>
          <a className="btn btn-primary" href="/entrar">Ir para o login</a>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container container-narrow">
        <div className="auth-panel">
          <div className="eyebrow"><span className="dot" /> Primeiro acesso</div>
          <h1 className="section-title" style={{ fontSize: 30 }}>Configurar administrador</h1>
          <p className="small text-muted" style={{ marginTop: 8 }}>
            Esta tela aparece apenas uma vez, enquanto não existir administrador. A senha é gravada com hash
            scrypt e nunca fica visível no código.
          </p>

          <form className="auth-form" onSubmit={submit}>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <div className="field">
              <label className="label" htmlFor="displayName">Nome de exibição</label>
              <input id="displayName" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="username">Nome de usuário</label>
              <input id="username" className="input" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="email">E-mail</label>
              <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="password">Senha administrativa</label>
              <input
                id="password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={10}
                autoComplete="new-password"
                required
              />
              <span className="hint">Mínimo de 10 caracteres. Guarde em local seguro.</span>
            </div>
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {busy ? 'Configurando…' : 'Criar credencial administrativa'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
