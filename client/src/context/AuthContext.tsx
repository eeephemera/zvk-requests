"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { apiFetch, ApiError } from "../services/apiClient";

// ---- Config (from environment) ----
const ENV_TTL = Number(process.env.NEXT_PUBLIC_AUTH_CACHE_TTL_MS || "0");
const ENV_BG_REFRESH = Number(process.env.NEXT_PUBLIC_AUTH_BACKGROUND_REFRESH_MS || "0");

// ---- Auth cache (client-side, non-sensitive) ----
const AUTH_CACHE_SCHEMA_VERSION = 2; // bump when structure changes
const AUTH_CACHE_KEY = `zvk_auth_cache_v${AUTH_CACHE_SCHEMA_VERSION}`;
const AUTH_SYNC_KEY = "zvk_auth_sync"; // cross-tab sync channel

// Defaults if env not provided
const AUTH_CACHE_TTL_MS = ENV_TTL > 0 ? ENV_TTL : 180_000; // 3 минуты
const BG_REFRESH_MS = ENV_BG_REFRESH > 0 ? ENV_BG_REFRESH : 300_000; // 5 минут

export interface AuthResponse {
  id: number;
  login: string;
  name?: string;
  email?: string;
  phone?: string | null;
  role: string;
  partner?: {
    id: number;
    name: string;
    address?: string;
    inn?: string;
    partner_status?: string;
  } | null;
}

type AuthCache = {
  user: AuthResponse;
  ts: number; // время успешной проверки
  ver: number; // схема
};

function saveAuthCache(user: AuthResponse) {
  try {
    const payload: AuthCache = { user, ts: Date.now(), ver: AUTH_CACHE_SCHEMA_VERSION };
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(payload));
    // Broadcast login/update to other tabs
    localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify({ type: "login", at: Date.now() }));
    localStorage.removeItem(AUTH_SYNC_KEY);
  } catch {}
}

function loadAuthCache(): AuthCache | null {
  try {
    // Clean older versions if exist
    for (let v = 1; v < AUTH_CACHE_SCHEMA_VERSION; v++) {
      const oldKey = `zvk_auth_cache_v${v}`;
      if (localStorage.getItem(oldKey)) localStorage.removeItem(oldKey);
    }
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthCache;
    if (parsed.ver !== AUTH_CACHE_SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearAuthCache() {
  try { localStorage.removeItem(AUTH_CACHE_KEY); } catch {}
  try {
    localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify({ type: "logout", at: Date.now() }));
    localStorage.removeItem(AUTH_SYNC_KEY);
  } catch {}
}

type AuthContextType = {
  isAuthenticated: boolean;
  userRole: string | null;
  userId: number | null;
  loading: boolean;
  logout: () => Promise<void>;
  checkAuth: (forceCheck?: boolean) => Promise<void>;
  updateAuthState: (userData: AuthResponse) => void;
};

const initialState: AuthContextType = {
  isAuthenticated: false,
  userRole: null,
  userId: null,
  loading: true,
  logout: async () => { console.warn("Logout function called before AuthProvider initialized"); },
  checkAuth: async () => { console.warn("checkAuth function called before AuthProvider initialized"); },
  updateAuthState: () => { console.warn("updateAuthState function called before AuthProvider initialized"); },
};

const AuthContext = createContext<AuthContextType>(initialState);
export const useAuth = () => useContext(AuthContext);

// Нормализация роли для устранения проблем с локализацией
const normalizeRole = (role: string): string => {
  const normalizedRole = role.toUpperCase();
  if (normalizedRole === "МЕНЕДЖЕР" || normalizedRole === "MANAGER") return "MANAGER";
  if (normalizedRole === "ПОЛЬЗОВАТЕЛЬ" || normalizedRole === "USER") return "USER";
  return role;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Троттлинг / бэкофф
  const isCheckingAuth = useRef(false);
  const lastAuthCheck = useRef<number>(0);
  const AUTH_CHECK_INTERVAL = 2000;
  const consecutiveErrors = useRef(0);
  const nextRetryAt = useRef(0);

  const handleAuthError = useCallback(() => {
    setIsAuthenticated(false);
    setUserRole(null);
    setUserId(null);
    if (typeof document !== 'undefined') {
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
  }, []);

  const resetAuthState = useCallback(() => {
    setIsAuthenticated(false);
    setUserRole(null);
    setUserId(null);
  }, []);

  const updateAuthState = useCallback((userData: AuthResponse) => {
    const normalizedRole = normalizeRole(userData.role);
    setIsAuthenticated(true);
    setUserRole(normalizedRole);
    setUserId(userData.id);
    setLoading(false);
    isCheckingAuth.current = false;
    lastAuthCheck.current = Date.now();
    consecutiveErrors.current = 0;
    nextRetryAt.current = 0;
    saveAuthCache({ ...userData, role: normalizedRole });
  }, []);

  const checkAuth = useCallback(async (forceCheck = false) => {
    const now = Date.now();

    // Backoff при сетевых ошибках
    if (!forceCheck && nextRetryAt.current && now < nextRetryAt.current) {
      if (!isAuthenticated) setLoading(false);
      return;
    }

    // Используем кэш, если свежий
    if (!forceCheck) {
      const cached = loadAuthCache();
      if (cached && now - cached.ts < AUTH_CACHE_TTL_MS) {
        if (!isAuthenticated) {
          const normalizedRole = normalizeRole(cached.user.role);
          setIsAuthenticated(true);
          setUserRole(normalizedRole);
          setUserId(cached.user.id);
        }
        setLoading(false);
        lastAuthCheck.current = cached.ts;
        return;
      }
    }

    // Троттлинг параллельных проверок
    if (!forceCheck && (isCheckingAuth.current || (now - lastAuthCheck.current < AUTH_CHECK_INTERVAL))) {
      if (!isAuthenticated) setLoading(false);
      return;
    }

    if (!isAuthenticated) setLoading(true);
    isCheckingAuth.current = true;

    try {
      const response = await apiFetch<AuthResponse>('/api/me');
      lastAuthCheck.current = Date.now();
      if (!response || typeof response.role !== 'string') throw new Error('Invalid response');
      updateAuthState(response);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        handleAuthError();
        clearAuthCache();
        consecutiveErrors.current = 0;
        nextRetryAt.current = 0;
      } else {
        // сетевые/прочие ошибки → экспоненциальный бэкофф
        consecutiveErrors.current += 1;
        const base = 5000; // 5s
        const maxBackoff = 60_000; // 60s
        const backoff = Math.min(maxBackoff, base * Math.pow(2, consecutiveErrors.current - 1));
        nextRetryAt.current = Date.now() + backoff;
        if (!isAuthenticated) resetAuthState();
      }
    } finally {
      setLoading(false);
      isCheckingAuth.current = false;
    }
  }, [isAuthenticated, resetAuthState, handleAuthError, updateAuthState]);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/logout', { method: 'POST' });
      if (typeof document !== 'undefined') {
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      }
      clearAuthCache();
      resetAuthState();
      window.location.replace('/login');
    } catch (error) {
      clearAuthCache();
      resetAuthState();
    }
  }, [resetAuthState]);

  // Инициализация
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = loadAuthCache();
      if (cached && Date.now() - cached.ts < AUTH_CACHE_TTL_MS) {
        const normalizedRole = normalizeRole(cached.user.role);
        setIsAuthenticated(true);
        setUserRole(normalizedRole);
        setUserId(cached.user.id);
        setLoading(false);
        lastAuthCheck.current = cached.ts;
        setTimeout(() => checkAuth(true), 0);
      } else {
        checkAuth(true);
      }
    } else {
      setLoading(false);
    }
  }, [checkAuth]);

  // Обновление по фокусу и возврату сети
  useEffect(() => {
    const onFocus = () => checkAuth(false);
    const onOnline = () => checkAuth(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [checkAuth]);

  // Кросс‑вкладочная синхронизация login/logout
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === AUTH_SYNC_KEY && e.newValue) {
        try {
          const msg = JSON.parse(e.newValue) as { type: string; at: number };
          if (msg.type === 'logout') {
            clearAuthCache();
            resetAuthState();
          }
          if (msg.type === 'login') {
            // Быстро гидратируем и валидируем
            const cached = loadAuthCache();
            if (cached) {
              const normalizedRole = normalizeRole(cached.user.role);
              setIsAuthenticated(true);
              setUserRole(normalizedRole);
              setUserId(cached.user.id);
              setLoading(false);
              lastAuthCheck.current = cached.ts;
              setTimeout(() => checkAuth(true), 0);
            } else {
              checkAuth(true);
            }
          }
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [checkAuth, resetAuthState]);

  // Фоновое автообновление
  useEffect(() => {
    const id = window.setInterval(() => {
      checkAuth(false);
    }, BG_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userRole,
        userId,
        loading,
        logout,
        checkAuth,
        updateAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
