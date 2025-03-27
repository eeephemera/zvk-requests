"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getHomepageForRole } from "@/utils/navigation";

export default function HomePage() {
  const { loading, isAuthenticated, userRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push("/login");
      } else {
        router.push(getHomepageForRole(userRole));
      }
    }
  }, [loading, isAuthenticated, userRole, router]);

  // Показываем заглушку загрузки
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--discord-bg)' }}>
      <div className="animate-spin w-12 h-12 border-4 border-discord-accent rounded-full border-t-transparent mb-4"></div>
      <p className="text-discord-text">Перенаправление...</p>
    </div>
  );
}