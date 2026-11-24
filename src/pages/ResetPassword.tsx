import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, authApi } from '../lib/api';
import { useApp } from '../state/AppContext';
import { ErrorNote } from '../components/ui';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useApp();

  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não conferem.');
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword({ token: token.trim(), password });
      toast('Senha redefinida. Entre com a nova senha.', 'success');
      navigate('/entrar', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Token inválido ou expirado.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section">
      <div className="container container-narrow">
        <div className="auth-panel">
          <div className="eyebrow"><span className="dot" /> Segurança</div>
          <h1 className="section-title" style={{ fontSize: 30 }}>Redefinir senha</h1>
          <p className="small text-muted" style={{ marginTop: 8 }}>
            Cole o token recebido e defina uma nova senha. Todas as sessões antigas serão encerradas.
          </p>

          <form className="auth-form" onSubmit={submit}>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <div className="field">
              <label className="label" htmlFor="token">Token de redefinição</label>
              <input id="token" className="input" value={token} onChange={(e) => setToken(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="password">Nova senha</label>
              <input
                id="password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="confirm">Confirmar nova senha</label>
              <input
                id="confirm"
                className="input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {busy ? 'Redefinindo…' : 'Redefinir senha'}
            </button>
          </form>

          <div className="row between" style={{ marginTop: 18 }}>
            <Link to="/entrar" className="tiny text-muted">Voltar ao login</Link>
            <Link to="/recuperar-senha" className="tiny text-muted">Gerar novo token</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
