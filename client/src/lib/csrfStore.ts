// Простое хранилище CSRF токена в памяти (session-scoped)
// НЕ храним в localStorage для безопасности

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  console.log('[csrfStore] Setting CSRF token:', token ? `${token.substring(0, 10)}...` : 'null');
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  console.log('[csrfStore] Getting CSRF token:', csrfToken ? `${csrfToken.substring(0, 10)}...` : 'null');
  return csrfToken;
}

export function clearCsrfToken() {
  console.log('[csrfStore] Clearing CSRF token');
  csrfToken = null;
}

