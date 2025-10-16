// Простое хранилище CSRF токена в памяти (session-scoped)
// НЕ храним в localStorage для безопасности

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export function clearCsrfToken() {
  csrfToken = null;
}

