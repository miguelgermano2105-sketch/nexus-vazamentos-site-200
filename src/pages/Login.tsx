import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, authApi } from '../lib/api';
import { useApp } from '../state/AppContext';
import { ErrorNote } from '../components/ui';

export default function Login() {
  const { refreshUser, toast } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/painel';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await authApi.login({ identifier: identifier.trim(), password });
      const me = await refreshUser();
      toast(`Bem-vindo de volta${me?.displayName ? `, ${me.displayName}` : ''}.`, 'success');
      navigate(next.startsWith('/') ? next : '/painel', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section">
      <div className="container auth-wrap">
        <div className="auth-art">
          <div className="eyebrow"><span className="dot" /> Área do membro</div>
          <h1 className="auth-art-title">Bem-vindo ao <span className="text-dim">22M</span></h1>
          <p className="text-muted small" style={{ marginTop: 14, maxWidth: 360 }}>
            Acesse favoritos, histórico, notificações, histórico da 22M AI e a comunidade em tempo real.
            Sessão protegida por cookie seguro no servidor.
          </p>
          <div className="divider" />
          <ul className="stack small text-muted" style={{ listStyle: 'none' }}>
            <li>✦ Biblioteca completa com filtros</li>
            <li>✦ 22M AI com histórico salvo</li>
            <li>✦ Chat público com membros online</li>
          </ul>
          <p className="signature" style={{ marginTop: 26 }}>DESENVOLVIDO POR SILVA</p>
        </div>

        <div className="auth-panel">
          <h2 style={{ fontSize: 22 }}>Entrar na conta</h2>
          <p className="small text-muted" style={{ marginTop: 6 }}>Use seu e-mail ou nome de usuário.</p>

          <form className="auth-form" onSubmit={submit}>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <div className="field">
              <label className="label" htmlFor="identifier">E-mail ou usuário</label>
              <input
                id="identifier"
                className="input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="password">Senha</label>
              <input
                id="password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
            <div className="row between">
              <Link to="/recuperar-senha" className="tiny text-muted">Esqueci minha senha</Link>
              <Link to="/criar-conta" className="tiny text-muted">Criar conta</Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
