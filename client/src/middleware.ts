import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(_request: NextRequest) {
  // Не решаем авторизацию на уровне middleware, так как JWT-кука на другом домене (api)
  // и недоступна здесь. Все проверки выполняет клиентский ProtectedRoute/AuthContext
  // через вызов /api/me с credentials: 'include'.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
