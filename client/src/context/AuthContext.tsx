"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

type AuthContextType = {
  isAuthenticated: boolean;
  userRole: string | null;
  userId: number | null;
  loading: boolean;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  userRole: null,
  userId: null,
  loading: true,
  logout: async () => {},
  checkAuth: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Централизованная функция сброса состояния авторизации
  const resetAuthState = useCallback(() => {
    setIsAuthenticated(false);
    setUserRole(null);
    setUserId(null);
  }, []);

  // Используем useCallback для мемоизации функции checkAuth
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/me`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setIsAuthenticated(true);
        setUserRole(data.role);
        setUserId(data.id);
      } else {
        resetAuthState();
      }
    } catch (error) {
      console.error("Auth check error:", error);
      resetAuthState();
    } finally {
      setLoading(false);
    }
  }, [resetAuthState]);

  // Также оборачиваем logout в useCallback
  const logout = useCallback(async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      resetAuthState();
    }
  }, [resetAuthState]);

  // Теперь указываем checkAuth в массиве зависимостей
  useEffect(() => {
    checkAuth();
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
