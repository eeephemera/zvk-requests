"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getHomepageForRole } from "@/utils/navigation";

// Эта страница будет вести себя как защищенная, но логика редиректа
// будет внутри ProtectedRoute, который вызовет getHomepageForRole

export default function HomePage() {
  const { isAuthenticated, userRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Ждем, пока загрузится состояние аутентификации
    if (loading) return;

    // Если пользователь аутентифицирован, перенаправляем на соответствующую домашнюю страницу
    if (isAuthenticated) {
      const homepage = getHomepageForRole(userRole);
      console.log(`Root page: redirecting authenticated user to ${homepage}`);
      router.replace(homepage);
    } else {
      // Если пользователь не аутентифицирован, перенаправляем на страницу входа
      console.log('Root page: redirecting unauthenticated user to login');
      router.replace('/login');
    }
  }, [isAuthenticated, userRole, loading, router]);

  // Показываем загрузчик во время перенаправления
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-discord-background">
      <div className="mb-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-discord-accent"></div>
      </div>
      <h1 className="text-discord-text text-xl">Загрузка приложения...</h1>
    </div>
  );
}