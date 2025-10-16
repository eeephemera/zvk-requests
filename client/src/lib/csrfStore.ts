// Session-based CSRF protection
// Генерируем уникальный токен для каждой сессии (вкладки браузера)
// Храним в sessionStorage - автоматически очищается при закрытии вкладки

const CSRF_TOKEN_KEY = 'zvk_csrf_token';

// In-memory кэш для предотвращения race conditions
let cachedToken: string | null = null;

function generateCsrfToken(): string {
  // Генерируем криптографически безопасный токен
  const array = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  }
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function setCsrfToken(token: string | null) {
  cachedToken = token;
  if (typeof sessionStorage !== 'undefined' && token) {
    sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  }
}

export function getCsrfToken(): string {
  if (typeof sessionStorage === 'undefined') {
    // SSR - возвращаем placeholder
    return 'csrf_ssr_placeholder';
  }

  // Проверяем in-memory кэш (быстро, без race condition)
  if (cachedToken) {
    return cachedToken;
  }

  // Проверяем sessionStorage
  let token = sessionStorage.getItem(CSRF_TOKEN_KEY);
  
  // Если токена нет - генерируем новый
  if (!token) {
    token = generateCsrfToken();
    sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  }
  
  // Кэшируем для следующих вызовов
  cachedToken = token;
  return token;
}

export function clearCsrfToken() {
  cachedToken = null;
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
  }
}

