"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="container mx-auto">
        <p className="text-gray-400 text-center">Перенаправление...</p>
      </div>
    </div>
  );
}