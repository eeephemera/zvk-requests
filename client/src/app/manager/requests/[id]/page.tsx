"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";

interface RequestPageProps {
  params: { id: string };
}

export default function RequestPage({ params }: RequestPageProps) {
  const router = useRouter();

  useEffect(() => {
    // Перенаправляем на /manager с параметром requestId
    router.replace(`/manager?requestId=${params.id}`);
  }, [params.id, router]);

  return (
    <ProtectedRoute allowedRoles={["Менеджер"]}>
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--discord-bg)' }}>
        <div className="discord-card p-6 animate-fadeIn">
          <div className="flex justify-center items-center space-x-3">
            <div className="w-6 h-6 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"></div>
            <p className="text-discord-text-muted">Перенаправление...</p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}