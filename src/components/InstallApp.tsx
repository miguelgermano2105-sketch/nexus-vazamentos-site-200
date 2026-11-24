import { useEffect, useState } from 'react';
import {
  INSTALL_DISMISS_KEY,
  canPromptInstall,
  detectPlatform,
  initInstallPrompt,
  isInstalled,
  promptInstall,
  subscribeInstall,
} from '../lib/install';

/**
 * Convite discreto para instalar o 22M como aplicativo no celular ou no computador.
 * O estado do instalador vive em src/lib/install.ts, compartilhado com a página /app.
 */
export default function InstallApp() {
  const [visible, setVisible] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    initInstallPrompt();

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === '1';
    } catch {
      dismissed = false;
    }
    if (dismissed || isInstalled()) return;

    setIosHint(detectPlatform() === 'ios');

    const sync = () => {
      if (isInstalled()) {
        setVisible(false);
        return;
      }
      const promptReady = canPromptInstall();
      setCanPrompt(promptReady);
      // Safari no iOS não dispara beforeinstallprompt: mostramos o caminho manual.
      setVisible(promptReady || detectPlatform() === 'ios');
    };

    sync();
    return subscribeInstall(sync);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    } catch {
      /* modo privado: segue sem persistir */
    }
  }

  async function install() {
    const result = await promptInstall();
    setCanPrompt(canPromptInstall());
    if (result === 'accepted') setVisible(false);
    else dismiss();
  }

  if (!visible) return null;

  return (
    <div className="install-app" role="dialog" aria-label="Instalar aplicativo">
      <span className="install-app__icon" aria-hidden="true">
        22
      </span>
      <div className="install-app__text">
        <strong>Instalar o app 22M</strong>
        <span>
          {iosHint && !canPrompt
            ? 'Toque em Compartilhar e escolha “Adicionar à Tela de Início”.'
            : 'Ícone na tela inicial, tela cheia e a 22M AI em um toque.'}
        </span>
      </div>
      {canPrompt ? (
        <button type="button" className="btn btn-primary install-app__cta" onClick={install}>
          Instalar
        </button>
      ) : null}
      <button type="button" className="install-app__close" onClick={dismiss} aria-label="Agora não">
        ×
      </button>
    </div>
  );
}
