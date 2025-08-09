"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { getHomepageForRole } from "@/utils/navigation";

type ProtectedRouteProps = {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectIfNotAllowed?: boolean;
  isPublicPage?: boolean;
};

export default function ProtectedRoute({
  children,
  allowedRoles = [],
  redirectIfNotAllowed = true,
  isPublicPage = false
}: ProtectedRouteProps) {
  const { isAuthenticated, userRole, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Убираем принудительный вызов checkAuth на маунте, чтобы не дублировать /api/me

  useEffect(() => {
    if (loading) {
      return;
    }

    if (isAuthenticated && isPublicPage) {
      const homePage = getHomepageForRole(userRole);
      router.replace(homePage);
      return;
    }

    if (!isAuthenticated && !isPublicPage) {
      const loginUrl = `/login?from=${encodeURIComponent(pathname || '/')}`;
      router.replace(loginUrl);
      return;
    }

    if (isAuthenticated && !isPublicPage && allowedRoles.length > 0 && userRole) {
      if (!allowedRoles.includes(userRole) && redirectIfNotAllowed) {
        const homePage = getHomepageForRole(userRole);
        router.replace(homePage);
        return;
      }
    }
  }, [isAuthenticated, userRole, loading, isPublicPage, allowedRoles, redirectIfNotAllowed, router, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-discord-text-muted mr-2">Проверка авторизации...</p>
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-discord-accent border-t-transparent"></div>
      </div>
    );
  }

  const canRenderContent = 
    (isPublicPage && !isAuthenticated) || 
    (!isPublicPage && isAuthenticated && (allowedRoles.length === 0 || (userRole && allowedRoles.includes(userRole))));

  if (canRenderContent) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-discord-accent border-t-transparent mb-4"></div>
      <p className="text-discord-text-muted">Перенаправление...</p>
    </div>
  );
}