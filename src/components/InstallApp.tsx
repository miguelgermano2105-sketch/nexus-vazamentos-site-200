import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'nexus_install_dismissed';

function alreadyInstalled(): boolean {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone;
}

/** Convite discreto para instalar o 22M como aplicativo no celular ou no computador. */
export default function InstallApp() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      dismissed = false;
    }
    if (dismissed || alreadyInstalled()) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setIosHint(false);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* ignora */
      }
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // Safari no iOS não dispara beforeinstallprompt: mostramos o caminho manual.
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && 'ontouchend' in document);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|edgios/i.test(ua);
    if (isIOS && isSafari) {
      setIosHint(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignora */
    }
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt().catch(() => undefined);
    const choice = await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    setPromptEvent(null);
    if (choice.outcome === 'accepted') setVisible(false);
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
          {iosHint
            ? 'Toque em Compartilhar e escolha “Adicionar à Tela de Início”.'
            : 'Ícone na tela inicial, tela cheia e a 22M AI em um toque.'}
        </span>
      </div>
      {iosHint ? null : (
        <button type="button" className="btn btn-primary install-app__cta" onClick={install}>
          Instalar
        </button>
      )}
      <button type="button" className="install-app__close" onClick={dismiss} aria-label="Agora não">
        ×
      </button>
    </div>
  );
}
