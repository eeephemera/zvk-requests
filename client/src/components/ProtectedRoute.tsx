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
  const { isAuthenticated, userRole, loading, checkAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Принудительно проверяем аутентификацию при монтировании компонента
  useEffect(() => {
    // Принудительная проверка аутентификации только в том случае, 
    // если куки существует, но состояние не аутентифицировано
    if (document.cookie.includes('token=') && !isAuthenticated && !loading) {
      console.log(`ProtectedRoute (${pathname}): Cookie exists but state is not authenticated. Force checking...`);
      checkAuth(true);
    }
  }, [pathname, isAuthenticated, loading, checkAuth]);

  useEffect(() => {
    // --- СТРОГО: Если все еще загружается, НИЧЕГО НЕ ДЕЛАЕМ --- 
    if (loading) {
      console.log(`ProtectedRoute (${pathname}): Auth state is loading. Waiting...`);
      return;
    }
    // -----------------------------------------------------------

    // --- Если загрузка завершена, принимаем решение ---
    console.log(`ProtectedRoute (${pathname}) Decision Check: IsAuth=${isAuthenticated}, Role=${userRole}, IsPublic=${isPublicPage}`);

    // СЛУЧАЙ 1: Авторизован + Публичная страница -> Редирект на домашнюю
    if (isAuthenticated && isPublicPage) {
      const homePage = getHomepageForRole(userRole);
      console.log(`ProtectedRoute (${pathname}): Redirecting AUTHENTICATED user from PUBLIC page to ${homePage}`);
      router.replace(homePage);
      return;
    }

    // СЛУЧАЙ 2: НЕ Авторизован + Защищенная страница -> Редирект на логин
    if (!isAuthenticated && !isPublicPage) {
      const loginUrl = `/login?from=${encodeURIComponent(pathname || '/')}`;
      console.log(`ProtectedRoute (${pathname}): Redirecting UNAUTHENTICATED user from PROTECTED page to ${loginUrl}`);
      router.replace(loginUrl);
      return;
    }

    // СЛУЧАЙ 3: Авторизован + Защищенная страница + НЕ та роль -> Редирект на домашнюю
    if (isAuthenticated && !isPublicPage && allowedRoles.length > 0 && userRole) {
      if (!allowedRoles.includes(userRole) && redirectIfNotAllowed) {
        const homePage = getHomepageForRole(userRole);
        console.log(`ProtectedRoute (${pathname}): User role (${userRole}) not allowed. Redirecting to ${homePage}`);
        router.replace(homePage);
        return;
      }
    }
    
    // Если ни одно из условий редиректа не сработало, значит можно рендерить
    console.log(`ProtectedRoute (${pathname}): Authorised to render content.`);

  }, [isAuthenticated, userRole, loading, isPublicPage, allowedRoles, redirectIfNotAllowed, router, pathname]);

  // --- Логика Рендеринга --- 

  // ВСЕГДА показываем загрузчик, если loading === true
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-discord-text-muted mr-2">Проверка авторизации...</p>
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-discord-accent border-t-transparent"></div>
      </div>
    );
  }

  // После загрузки, рендерим контент ТОЛЬКО если условия позволяют
  const canRenderContent = 
    (isPublicPage && !isAuthenticated) || 
    (!isPublicPage && isAuthenticated && (allowedRoles.length === 0 || (userRole && allowedRoles.includes(userRole))));

  if (canRenderContent) {
    // Успешно прошли проверку - рендерим дочерние компоненты
    return <>{children}</>;
  }

  // Если не загрузка и не можем рендерить - значит, ожидаем редиректа из useEffect.
  // Показываем заглушку, чтобы избежать моргания неправильным контентом.
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-discord-accent border-t-transparent mb-4"></div>
      <p className="text-discord-text-muted">Перенаправление...</p>
    </div>
  );
}