import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, authApi } from '../lib/api';
import { useApp } from '../state/AppContext';
import { ErrorNote } from '../components/ui';

export default function Register() {
  const { refreshUser, toast } = useApp();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
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
      await authApi.register({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
      });
      await refreshUser();
      toast('Conta criada com sucesso. Bem-vindo ao NEXUS!', 'success');
      navigate('/painel', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a conta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section">
      <div className="container auth-wrap">
        <div className="auth-art">
          <div className="eyebrow"><span className="dot" /> Novo membro</div>
          <h1 className="auth-art-title">Crie sua <span className="text-dim">conta</span></h1>
          <p className="text-muted small" style={{ marginTop: 14, maxWidth: 360 }}>
            Gratuito e sem limites de tempo. Sua conta guarda favoritos, histórico e notificações em qualquer
            dispositivo.
          </p>
          <div className="divider" />
          <ul className="stack small text-muted" style={{ listStyle: 'none' }}>
            <li>✦ Senhas protegidas com hash scrypt</li>
            <li>✦ Sessões httpOnly e SameSite</li>
            <li>✦ Permissões verificadas no servidor</li>
          </ul>
          <p className="signature" style={{ marginTop: 26 }}>DESENVOLVIDO POR SILVA</p>
        </div>

        <div className="auth-panel">
          <h2 style={{ fontSize: 22 }}>Criar conta</h2>
          <p className="small text-muted" style={{ marginTop: 6 }}>Leva menos de um minuto.</p>

          <form className="auth-form" onSubmit={submit}>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <div className="field">
              <label className="label" htmlFor="displayName">Nome de exibição</label>
              <input
                id="displayName"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                minLength={2}
                maxLength={40}
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="username">Nome de usuário</label>
              <input
                id="username"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="ex: silva"
                pattern="[a-z0-9_]{3,20}"
                title="3 a 20 caracteres: letras minúsculas, números e _"
                required
              />
              <span className="hint">3 a 20 caracteres: letras minúsculas, números e _</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="email">E-mail</label>
              <input
                id="email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
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
                autoComplete="new-password"
                minLength={8}
                required
              />
              <span className="hint">Mínimo de 8 caracteres.</span>
            </div>
            <div className="field">
              <label className="label" htmlFor="confirm">Confirmar senha</label>
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
              {busy ? 'Criando conta…' : 'Criar conta'}
            </button>
            <div className="row between">
              <span className="tiny text-muted">Ao criar a conta você aceita as regras de convivência.</span>
              <Link to="/entrar" className="tiny text-muted">Já tenho conta</Link>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
