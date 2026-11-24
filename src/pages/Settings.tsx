import { useApp } from '../state/AppContext';
import type { EffectIntensity } from '../state/AppContext';

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="switch-row">
      <div>
        <strong className="small">{label}</strong>
        <p className="tiny text-muted" style={{ marginTop: 2 }}>{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="knob" />
      </button>
    </div>
  );
}

export default function Settings() {
  const { prefs, updatePrefs, user, toast } = useApp();

  const setIntensity = (intensity: EffectIntensity) => updatePrefs({ intensity });

  return (
    <section className="section">
      <div className="container">
        <div className="eyebrow"><span className="dot" /> Experiência</div>
        <h1 className="section-title">Configurações</h1>
        <p className="section-sub">
          Ajuste os efeitos visuais da plataforma. As preferências ficam salvas neste navegador e nunca
          comprometem o desempenho.
        </p>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div className="glass-panel card-pad">
            <h2 className="card-title" style={{ fontSize: 18, marginBottom: 14 }}>Efeitos visuais</h2>
            <Toggle
              label="Partículas flutuantes"
              hint="Pontos de luz discretos no fundo."
              checked={prefs.particles}
              onChange={(v) => updatePrefs({ particles: v })}
            />
            <Toggle
              label="Neve"
              hint="Camada de neve leve, opcional."
              checked={prefs.snow}
              onChange={(v) => updatePrefs({ snow: v })}
            />
            <Toggle
              label="Animações"
              hint="Transições, entradas e efeitos de hover."
              checked={prefs.animations}
              onChange={(v) => updatePrefs({ animations: v })}
            />
            <Toggle
              label="Movimento reduzido"
              hint="Desativa animações e a introdução cinematográfica."
              checked={prefs.reduceMotion}
              onChange={(v) => updatePrefs({ reduceMotion: v })}
            />
          </div>

          <div className="glass-panel card-pad">
            <h2 className="card-title" style={{ fontSize: 18, marginBottom: 14 }}>Intensidade dos efeitos</h2>
            <div className="chips">
              {(['low', 'medium', 'high'] as EffectIntensity[]).map((level) => (
                <button
                  key={level}
                  className={`chip${prefs.intensity === level ? ' active' : ''}`}
                  onClick={() => setIntensity(level)}
                >
                  {level === 'low' ? 'Baixa' : level === 'medium' ? 'Média' : 'Alta'}
                </button>
              ))}
            </div>
            <div className="divider" />
            <h3 className="small" style={{ marginBottom: 8 }}>Introdução cinematográfica</h3>
            <p className="tiny text-muted" style={{ marginBottom: 12 }}>
              Reproduzida uma vez por sessão. Você pode assistir novamente quando quiser.
            </p>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                try {
                  sessionStorage.removeItem('nexus_intro_seen');
                } catch {
                  /* indisponível */
                }
                toast('A introdução será exibida na próxima página inicial.', 'info');
              }}
            >
              Assistir novamente
            </button>
          </div>

          <div className="glass-panel card-pad">
            <h2 className="card-title" style={{ fontSize: 18, marginBottom: 14 }}>Conta</h2>
            {user ? (
              <ul className="stack small" style={{ listStyle: 'none' }}>
                <li className="row between"><span className="text-muted">Nome de exibição</span><span>{user.displayName}</span></li>
                <li className="row between"><span className="text-muted">Usuário</span><span>@{user.username}</span></li>
                <li className="row between"><span className="text-muted">Permissão</span><span>{user.role}</span></li>
              </ul>
            ) : (
              <p className="small text-muted">Entre na sua conta para gerenciar perfil e senha.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
