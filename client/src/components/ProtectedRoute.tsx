"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AccessDenied from "./AccessDenied";
import { getHomepageForRole } from "@/utils/navigation";

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles: string[];
  redirectIfNotAllowed?: boolean;
};

export default function ProtectedRoute({
  children,
  allowedRoles,
  redirectIfNotAllowed = false,
}: ProtectedRouteProps) {
  const { loading, isAuthenticated, userRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/login");
      } else if (
        redirectIfNotAllowed &&
        userRole &&
        !allowedRoles.includes(userRole)
      ) {
        // Перенаправление на домашнюю страницу в зависимости от роли
        router.push(getHomepageForRole(userRole));
      }
    }
  }, [loading, isAuthenticated, userRole, router, allowedRoles, redirectIfNotAllowed]);

  // Показываем загрузку
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--discord-bg)' }}>
        <div className="animate-spin w-12 h-12 border-4 border-discord-accent rounded-full border-t-transparent"></div>
      </div>
    );
  }

  // Проверяем авторизацию
  if (!isAuthenticated) {
    return null; // Будет редирект на страницу логина
  }

  // Проверяем права доступа
  if (userRole && !allowedRoles.includes(userRole)) {
    return redirectIfNotAllowed ? null : <AccessDenied />;
  }

  return <>{children}</>;
} 