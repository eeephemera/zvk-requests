import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Список путей, которые доступны без аутентификации
const PUBLIC_PATHS = ['/login', '/register'];

// Определение API путей и статических файлов
const BYPASS_PATHS = [
  '/api/',
  '/_next/',
  '/favicon.ico',
  '/images/',
  '/assets/',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Игнорируем API запросы и статические файлы
  if (BYPASS_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  // Получаем токен из куки
  const hasAuthToken = request.cookies.has('token');
  
  // Корневой путь: перенаправляем на логин, если нет токена
  if (pathname === '/' && !hasAuthToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Защищенные пути: перенаправляем на логин, если нет токена
  if (!hasAuthToken && !PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // В остальных случаях позволяем Next.js и клиентскому коду принимать решения
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
