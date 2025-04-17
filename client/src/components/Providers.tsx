"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// Опционально: Для DevTools
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Создаем инстанс QueryClient ОДИН РАЗ с помощью useState,
  // чтобы он не создавался заново при каждом рендере
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Глобальные настройки для всех запросов (опционально)
        // Например, время, в течение которого данные считаются "свежими"
        staleTime: 5 * 60 * 1000, // 5 минут
         // Настройки повторных попыток при ошибке
        retry: 1, // Повторить 1 раз при ошибке
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Добавляем DevTools для удобства разработки (не попадет в продакшен-сборку) */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
} 