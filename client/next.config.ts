import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Прокси для API запросов
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*', // Прокси на сервер Go
      },
    ]
  },
  // Дополнительные настройки, если они нужны
  reactStrictMode: true,  // Для включения режима строгой проверки
};

export default nextConfig;
