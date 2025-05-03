"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
// Use relative path to avoid potential alias issues
import { apiFetch, ApiError } from "../services/apiClient";

// Экспортируем тип пользователя, чтобы его можно было использовать в других местах
export interface AuthResponse {
  id: number;
  login: string; // Делаем login обязательным, т.к. сервер всегда его возвращает
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

type AuthContextType = {
  isAuthenticated: boolean;
  userRole: string | null; // Standardized to string
  userId: number | null;
  loading: boolean;
  logout: () => Promise<void>;
  checkAuth: (forceCheck?: boolean) => Promise<void>;
  updateAuthState: (userData: AuthResponse) => void; // Добавляем функцию обновления
};

// Initial state better reflects loading and unknown auth status
const initialState: AuthContextType = {
  isAuthenticated: false,
  userRole: null,
  userId: null,
  loading: true, // Start in loading state
  logout: async () => { console.warn("Logout function called before AuthProvider initialized"); },
  checkAuth: async () => { console.warn("checkAuth function called before AuthProvider initialized"); },
  updateAuthState: () => { console.warn("updateAuthState function called before AuthProvider initialized"); }, // Добавляем заглушку
};

const AuthContext = createContext<AuthContextType>(initialState);

export const useAuth = () => useContext(AuthContext);

// Нормализация роли для устранения проблем с локализацией
const normalizeRole = (role: string): string => {
  const normalizedRole = role.toUpperCase();
  
  if (normalizedRole === "МЕНЕДЖЕР" || normalizedRole === "MANAGER") {
    return "MANAGER";
  }
  
  if (normalizedRole === "ПОЛЬЗОВАТЕЛЬ" || normalizedRole === "USER") {
    return "USER";
  }
  
  return role; // Возвращаем как есть, если не смогли нормализовать
};

// Прямая проверка наличия куки без выполнения запроса к API
function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  
  // Ищем куку token
  return document.cookie.split(';').some(cookie => 
    cookie.trim().startsWith('token=')
  );
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Состояние авторизации
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Оптимизация запросов
  const isCheckingAuth = useRef(false);
  const lastAuthCheck = useRef<number>(0);
  const AUTH_CHECK_INTERVAL = 2000; // 2 секунды между проверками

  // Обработка ошибки, если данные авторизации устарели
  const handleAuthError = useCallback(() => {
    setIsAuthenticated(false);
    setUserRole(null);
    setUserId(null);
    
    // Очищаем куки на стороне клиента как резервная мера
    if (typeof document !== 'undefined') {
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }
  }, []);

  // Централизованный сброс состояния
  const resetAuthState = useCallback(() => {
    setIsAuthenticated(false);
    setUserRole(null);
    setUserId(null);
  }, []);
  
  // Функция для прямого обновления состояния
  const updateAuthState = useCallback((userData: AuthResponse) => {
    const normalizedRole = normalizeRole(userData.role);
    setIsAuthenticated(true);
    setUserRole(normalizedRole);
    setUserId(userData.id);
    setLoading(false); // Считаем загрузку завершенной после прямого обновления
    isCheckingAuth.current = false; // Сбрасываем флаг проверки
    lastAuthCheck.current = Date.now(); // Обновляем время последней проверки
  }, []);

  // Проверка авторизации через API
  const checkAuth = useCallback(async (forceCheck = false) => {
    // Защита от параллельных запросов и частых проверок (если не принудительный запрос)
    const now = Date.now();
    if (!forceCheck && (isCheckingAuth.current || (now - lastAuthCheck.current < AUTH_CHECK_INTERVAL))) {
      console.log("AuthContext: Skipping check due to throttling");
      // Если пропускаем проверку, но состояние уже не аутентифицировано, надо завершить загрузку
      if (!isAuthenticated) {
         setLoading(false);
      }
      return;
    }

    // Если мы не знаем статус (не аутентифицированы), но начинаем проверку, установим loading
    // Это предотвратит мигание контента защищенных роутов
    if (!isAuthenticated) {
       setLoading(true);
    }
    isCheckingAuth.current = true; // Ставим флаг *перед* try

    try {
      console.log("AuthContext: Starting API authentication check");
      // Запрос к API для получения данных пользователя
      const response = await apiFetch<AuthResponse>('/api/me');
      
      // Обновляем время последней проверки
      lastAuthCheck.current = Date.now();
      
      if (!response) {
        throw new Error('Empty response from API');
      }
      
      if (typeof response.role !== 'string') {
        throw new Error('Invalid role format in API response');
      }

      console.log("AuthContext: API check successful, user data:", response);
      
      // Используем функцию прямого обновления состояния
      updateAuthState(response);
    } catch (error) {
      console.error("AuthContext: Authentication check failed", error);
      
      // Сброс состояния при ошибке авторизации
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        console.log("AuthContext: Authentication error (401/403), resetting state");
        handleAuthError();
      } else {
        // При других ошибках (сеть и т.д.) не сбрасываем состояние, если уже авторизованы
        // Это предотвращает "выбрасывание" пользователя при временных проблемах с сетью
        if (!isAuthenticated) {
          console.log("AuthContext: Network or other error, resetting state (not authenticated)");
          resetAuthState();
        } else {
          console.log("AuthContext: Network or other error, keeping state (already authenticated)");
        }
      }
    } finally {
      setLoading(false);
      isCheckingAuth.current = false;
    }
  }, [isAuthenticated, resetAuthState, handleAuthError, updateAuthState]); // Добавляем updateAuthState в зависимости

  // Выход из системы
  const logout = useCallback(async () => {
    try {
      console.log("Logging out...");
      
      // Делаем запрос на выход
      await apiFetch('/api/logout', { method: 'POST' });
      
      // Очищаем куки на клиенте для надежности
      if (typeof document !== 'undefined') {
        document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      }
      
      // Сбрасываем состояние
      resetAuthState();
      
      // Перенаправление на страницу входа
      window.location.replace('/login');
    } catch (error) {
      console.error("Logout failed:", error);
      
      // Даже при ошибке сбрасываем состояние
      resetAuthState();
    }
  }, [resetAuthState]);

  // Инициализация - проверяем авторизацию при первой загрузке
  useEffect(() => {
    console.log("AuthContext: Initial authentication check");
    // Вместо предварительной проверки cookie, всегда пытаемся проверить через API,
    // если мы находимся на клиенте. checkAuth обработает отсутствие cookie.
    if (typeof window !== 'undefined') {
      console.log("AuthContext: Running on client, attempting API check...");
      checkAuth(true); // Принудительная проверка при инициализации на клиенте
    } else {
      // На сервере или в среде без window, просто завершаем загрузку
      console.log("AuthContext: Not running on client or window undefined, setting loading false");
      setLoading(false);
    }
  }, [checkAuth]); // Зависимость только от checkAuth

  // Provider с контекстом
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userRole,
        userId,
        loading,
        logout,
        checkAuth,
        updateAuthState // Передаем функцию в контекст
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
