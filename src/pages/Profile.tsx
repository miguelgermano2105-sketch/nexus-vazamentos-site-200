import { useEffect, useRef, useState } from 'react';
import { ApiError, authApi } from '../lib/api';
import { useApp } from '../state/AppContext';
import { Avatar, ErrorNote, LoadingBlock } from '../components/ui';
import { formatDate } from '../lib/format';

const MAX_AVATAR_BYTES = 220 * 1024;

export default function Profile() {
  const { user, refreshUser, toast } = useApp();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setBio(user.bio || '');
      setAvatar(user.avatar);
    }
  }, [user]);

  if (!user) return <LoadingBlock label="Carregando perfil…" />;

  const pickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
      setError('Formato inválido. Use PNG, JPG, WEBP ou GIF.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('A imagem deve ter no máximo 200 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await authApi.updateProfile({ displayName: displayName.trim(), bio: bio.trim(), avatar });
      await refreshUser();
      toast('Perfil atualizado.', 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPassword.length < 8) {
      setPwError('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('As senhas não conferem.');
      return;
    }
    setPwSaving(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Senha alterada com sucesso.', 'success');
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <section className="section">
      <div className="container">
        <div className="eyebrow"><span className="dot" /> Conta</div>
        <h1 className="section-title">Meu perfil</h1>
        <p className="section-sub">Membro desde {formatDate(user.createdAt)}.</p>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <form className="glass-panel card-pad" onSubmit={saveProfile}>
            <h2 className="card-title" style={{ fontSize: 18, marginBottom: 16 }}>Dados públicos</h2>
            {error ? <ErrorNote>{error}</ErrorNote> : null}

            <div className="row" style={{ gap: 16, marginBottom: 18 }}>
              <Avatar name={user.displayName} src={avatar} size="lg" />
              <div className="stack" style={{ gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
                  Alterar foto
                </button>
                {avatar ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAvatar(null)}>
                    Remover foto
                  </button>
                ) : null}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={(e) => pickAvatar(e.target.files?.[0])}
                />
                <span className="tiny text-muted">Máximo 200 KB.</span>
              </div>
            </div>

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
              <label className="label" htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                className="textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                rows={4}
                placeholder="Conte um pouco sobre você."
              />
              <span className="hint">{bio.length}/280</span>
            </div>
            <div className="field">
              <label className="label">Nome de usuário</label>
              <input className="input" value={`@${user.username}`} readOnly disabled />
            </div>
            <button className="btn btn-primary" disabled={saving} type="submit">
              {saving ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </form>

          <form className="glass-panel card-pad" onSubmit={savePassword}>
            <h2 className="card-title" style={{ fontSize: 18, marginBottom: 16 }}>Segurança</h2>
            {pwError ? <ErrorNote>{pwError}</ErrorNote> : null}
            <div className="field">
              <label className="label" htmlFor="current">Senha atual</label>
              <input
                id="current"
                className="input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="new">Nova senha</label>
              <input
                id="new"
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            <div className="field">
              <label className="label" htmlFor="confirmNew">Confirmar nova senha</label>
              <input
                id="confirmNew"
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <button className="btn btn-ghost" disabled={pwSaving} type="submit">
              {pwSaving ? 'Alterando…' : 'Alterar senha'}
            </button>
            <p className="tiny text-muted" style={{ marginTop: 12 }}>
              Senhas são armazenadas com hash scrypt. Nenhuma senha é gravada em texto puro.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
