import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, authApi } from '../lib/api';
import { ErrorNote } from '../components/ui';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await authApi.forgotPassword({ identifier: identifier.trim() });
      setMessage(res.message);
      if (res.token) setToken(res.token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível processar a solicitação.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section">
      <div className="container container-narrow">
        <div className="auth-panel">
          <div className="eyebrow"><span className="dot" /> Recuperação</div>
          <h1 className="section-title" style={{ fontSize: 30 }}>Recuperar senha</h1>
          <p className="small text-muted" style={{ marginTop: 8 }}>
            Informe seu e-mail ou usuário. Geramos um link de redefinição com validade de 30 minutos.
          </p>

          <form className="auth-form" onSubmit={submit}>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            {message ? <div className="form-ok">{message}</div> : null}
            <div className="field">
              <label className="label" htmlFor="identifier">E-mail ou usuário</label>
              <input
                id="identifier"
                className="input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary btn-block" disabled={busy} type="submit">
              {busy ? 'Gerando link…' : 'Gerar link de redefinição'}
            </button>
          </form>

          {token ? (
            <div className="glass-panel card-pad" style={{ marginTop: 18 }}>
              <strong className="small">Token de redefinição gerado</strong>
              <p className="tiny text-muted" style={{ marginTop: 6 }}>
                Este ambiente não possui serviço de e-mail configurado. Use o token abaixo para redefinir agora.
              </p>
              <code className="tiny" style={{ display: 'block', marginTop: 8, wordBreak: 'break-all' }}>{token}</code>
              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => navigate(`/redefinir-senha?token=${encodeURIComponent(token)}`)}
              >
                Redefinir senha agora
              </button>
            </div>
          ) : null}

          <div className="row between" style={{ marginTop: 18 }}>
            <Link to="/entrar" className="tiny text-muted">Voltar ao login</Link>
            <Link to="/criar-conta" className="tiny text-muted">Criar conta</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
