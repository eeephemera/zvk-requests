"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
// Use relative path to avoid potential alias issues
import { apiFetch, ApiError } from "../services/apiClient";

type AuthContextType = {
  isAuthenticated: boolean;
  userRole: string | null; // Standardized to string
  userId: number | null;
  loading: boolean;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
};

// Initial state better reflects loading and unknown auth status
const initialState: AuthContextType = {
  isAuthenticated: false,
  userRole: null,
  userId: null,
  loading: true, // Start in loading state
  logout: async () => { console.warn("Logout function called before AuthProvider initialized"); },
  checkAuth: async () => { console.warn("checkAuth function called before AuthProvider initialized"); },
};

const AuthContext = createContext<AuthContextType>(initialState);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(initialState.isAuthenticated);
  // Ensure userRole state aligns with the standardized type (string or enum)
  const [userRole, setUserRole] = useState<string | null>(initialState.userRole);
  const [userId, setUserId] = useState<number | null>(initialState.userId);
  const [loading, setLoading] = useState(initialState.loading);

  // Centralized reset function
  const resetAuthState = useCallback(() => {
    // console.log("Resetting auth state"); // Removed log
    setIsAuthenticated(false);
    setUserRole(null);
    setUserId(null);
    // Optionally: Clear any other auth-related cached data if needed
  }, []);

  // Memoized checkAuth function
  const checkAuth = useCallback(async () => {
    // console.log("Checking authentication status..."); // Removed log
    setLoading(true);
    try {
      const data = await apiFetch<{ id: number; role: string }>('/api/me');
      // console.log("Auth check successful, user data:", data); // Removed log
      setIsAuthenticated(true);
      setUserRole(data.role);
      setUserId(data.id);
    } catch (error: unknown) {
      console.error("Auth check failed:"); // Keep error logs
      if (error instanceof ApiError) {
        // console.log("Auth check resulted in 401 (likely expired/invalid session)."); // Removed log (implicit in 401 error)
         if (error.status !== 401) { // Don't log expected 401s as errors unless needed
             console.error(`ApiError during auth check (status ${error.status}): ${error.message}`, error.data);
         }
      } else if (error instanceof Error) {
          console.error("An unexpected standard error occurred during auth check:", error.message, error.stack);
      } else {
          console.error("An unexpected non-error value was thrown during auth check:", error);
      }
      resetAuthState();
    } finally {
      setLoading(false);
      // console.log("Auth check finished."); // Removed log
    }
  }, [resetAuthState]);

  // Memoized logout function
  const logout = useCallback(async () => {
    // console.log("Logging out..."); // Removed log
    try {
        await apiFetch<null>('/api/logout', {
            method: "POST",
        });
        // console.log("Logout API call successful."); // Removed log
    } catch (error: unknown) {
        console.error("Logout API call failed:"); // Keep error logs
        if (error instanceof ApiError) {
            console.error(`ApiError during logout (status ${error.status}): ${error.message}`, error.data);
        } else if (error instanceof Error) {
            console.error("Standard error during logout:", error.message, error.stack);
        } else {
            console.error("Unexpected non-error value thrown during logout:", error);
        }
    } finally {
      resetAuthState();
      // console.log("Auth state reset after logout attempt."); // Removed log
    }
  }, [resetAuthState]);

  // Initial check on component mount
  useEffect(() => {
    checkAuth();
    // No dependencies other than the memoized checkAuth function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userRole,
        userId,
        loading,
        logout,
        checkAuth, // Provide the checkAuth function if needed by components
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
