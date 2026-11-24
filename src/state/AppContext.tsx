import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, authApi, contentApi } from '../lib/api';
import type { User } from '../lib/types';
import { normalizeSettings } from '../lib/format';

export type EffectIntensity = 'low' | 'medium' | 'high';

export interface Prefs {
  snow: boolean;
  particles: boolean;
  animations: boolean;
  intensity: EffectIntensity;
  reduceMotion: boolean;
}

type ToastKind = 'info' | 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface AppContextValue {
  user: User | null;
  booting: boolean;
  needsAdmin: boolean;
  settings: ReturnType<typeof normalizeSettings>;
  refreshUser: () => Promise<User | null>;
  refreshSettings: () => Promise<void>;
  logout: () => Promise<void>;
  favoriteIds: number[];
  toggleFavorite: (id: number) => Promise<boolean>;
  prefs: Prefs;
  updatePrefs: (patch: Partial<Prefs>) => void;
  toasts: ToastItem[];
  toast: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;
  isStaff: boolean;
  isAdmin: boolean;
}

const DEFAULT_PREFS: Prefs = {
  snow: false,
  particles: true,
  animations: true,
  intensity: 'medium',
  reduceMotion: false,
};

const AppContext = createContext<AppContextValue | null>(null);

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem('nexus_prefs');
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!raw) return { ...DEFAULT_PREFS, reduceMotion: prefersReduced };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw), reduceMotion: prefersReduced };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

const USER_CACHE = 'nexus_user';

/** Último usuário conhecido: permite abrir o site já reconhecendo a sessão. */
function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function cacheUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_CACHE, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE);
  } catch {
    /* armazenamento indisponível */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readCachedUser);
  const [booting, setBooting] = useState(true);
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [settings, setSettings] = useState(() => normalizeSettings(null));
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastSeq = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((list) => [...list, { id, message, kind }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await contentApi.publicSettings();
      setSettings(normalizeSettings(res.settings));
    } catch {
      /* mantém os padrões */
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUser(res.user);
      cacheUser(res.user);
      return res.user;
    } catch {
      setUser(null);
      cacheUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [me, pub, setup] = await Promise.all([
          authApi.me().catch(() => ({ user: null as User | null })),
          contentApi.publicSettings().catch(() => ({ settings: {} as Record<string, string> })),
          authApi.setupStatus().catch(() => ({ needsAdmin: false, signedIn: false })),
        ]);
        if (!alive) return;
        setUser(me.user);
        cacheUser(me.user);
        setSettings(normalizeSettings(pub.settings));
        setNeedsAdmin(setup.needsAdmin);
        if (me.user) {
          try {
            const home = await contentApi.home();
            if (alive) setFavoriteIds(home.favoriteIds || []);
          } catch {
            /* opcional */
          }
        }
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('nexus_prefs', JSON.stringify(prefs));
    } catch {
      /* armazenamento indisponível */
    }
    const root = document.documentElement;
    root.classList.toggle('reduce-motion', prefs.reduceMotion || !prefs.animations);
    root.classList.toggle('no-fx', !prefs.particles && !prefs.snow);
  }, [prefs]);

  const updatePrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => ({ ...p, ...patch }));
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    setUser(null);
    cacheUser(null);
    setFavoriteIds([]);
  }, []);

  const toggleFavorite = useCallback(
    async (id: number) => {
      if (!user) {
        toast('Entre na sua conta para salvar favoritos.', 'error');
        return false;
      }
      try {
        const res = await contentApi.toggleFavorite(id);
        setFavoriteIds((ids) => (res.favorited ? [...new Set([...ids, id])] : ids.filter((x) => x !== id)));
        toast(res.favorited ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.', 'success');
        return res.favorited;
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Não foi possível atualizar o favorito.', 'error');
        return false;
      }
    },
    [user, toast],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      booting,
      needsAdmin,
      settings,
      refreshUser,
      refreshSettings,
      logout,
      favoriteIds,
      toggleFavorite,
      prefs,
      updatePrefs,
      toasts,
      toast,
      dismissToast,
      isStaff: user?.role === 'admin' || user?.role === 'moderator',
      isAdmin: user?.role === 'admin',
    }),
    [user, booting, needsAdmin, settings, refreshUser, refreshSettings, logout, favoriteIds, toggleFavorite, prefs, updatePrefs, toasts, toast, dismissToast],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
  return ctx;
}
