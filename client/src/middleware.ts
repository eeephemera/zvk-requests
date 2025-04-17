import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Пути, доступные без аутентификации
const PUBLIC_PATHS = ['/login', '/register']; // Добавьте все публичные пути

// Путь по умолчанию для аутентифицированных пользователей
const DEFAULT_AUTHENTICATED_PATH = '/requests'; // Или '/manager' в зависимости от роли, но здесь мы роль не знаем

export function middleware(request: NextRequest) {
  const tokenCookie = request.cookies.get('token');
  const tokenValue = tokenCookie?.value;
  const { pathname } = request.nextUrl;
  
  const publicPaths = ['/login', '/register']; // Add other public paths if needed
  const isPublicPath = publicPaths.includes(pathname);

  if (!tokenValue) {
    // No token exists
    if (!isPublicPath) {
      // If trying to access a protected path without a token, redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Allow access to public paths if no token
    return NextResponse.next();
  }

  // Token exists
  if (isPublicPath) {
    // If logged in (token exists) and trying to access login/register, redirect away
    // TODO: Implement role-based redirect here using getHomepageForRole if JWT could be decoded
    const defaultAuthenticatedPath = '/'; // Redirect to root for now
    return NextResponse.redirect(new URL(defaultAuthenticatedPath, request.url));
  }

  // Token exists and path is not public, allow access
  // Role validation happens client-side in ProtectedRoute
  return NextResponse.next();
}

// Конфигурация: указывает, к каким путям применять middleware
export const config = {
  matcher: [
    /*
     * Сопоставлять все пути запросов, кроме тех, что начинаются с:
     * - api (API роуты)
     * - _next/static (статические файлы)
     * - _next/image (файлы оптимизации изображений)
     * - favicon.ico (файл иконки)
     * - /public (статические ассеты в /public) - если есть
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
