/**
 * Ponte única entre o navegador e a interface de instalação do app.
 *
 * O evento `beforeinstallprompt` é disparado uma vez, logo após o carregamento.
 * Se ninguém estiver ouvindo naquele instante, ele se perde — por isso o
 * registro acontece em `initInstallPrompt()` (chamado no main.tsx, antes do
 * React montar) e a interface apenas consulta/assina este store.
 */

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type Platform = 'android' | 'ios' | 'desktop';

export const INSTALL_DISMISS_KEY = 'nexus_install_dismissed';

type Listener = () => void;

let deferred: InstallPromptEvent | null = null;
let installedFlag = false;
let started = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* um assinante com erro não pode quebrar os outros */
    }
  });
}

/** Registra os eventos do navegador uma única vez, antes da primeira renderização. */
export function initInstallPrompt() {
  if (started || typeof window === 'undefined') return;
  started = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Sem preventDefault o Chrome exibe a faixa nativa; aqui controlamos o convite.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    installedFlag = true;
    deferred = null;
    try {
      localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    } catch {
      /* modo privado: segue sem persistir */
    }
    notify();
  });
}

export function subscribeInstall(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** App já aberto como aplicativo instalado (ou acabou de ser instalado). */
export function isInstalled(): boolean {
  return installedFlag || isStandalone();
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && 'ontouchend' in document);
  if (isIOS) return 'ios';
  return 'desktop';
}

/** Abre o instalador nativo. Cada prompt só pode ser usado uma vez. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferred;
  if (!event) return 'unavailable';
  deferred = null;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') {
      installedFlag = true;
      notify();
      return 'accepted';
    }
    notify();
    return 'dismissed';
  } catch {
    notify();
    return 'unavailable';
  }
}
