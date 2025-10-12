# ZVK Requests

Веб‑приложение для управления заявками и регистрацией сделок.

## Архитектура

- `client/` — фронтенд (Next.js, TypeScript)
- `server/` — бэкенд (Go), без клиентских артефактов
  - JWT в `HttpOnly` cookie + refresh‑ротация
  - CSRF (double‑submit cookie `csrf_token` + заголовок `X-CSRF-Token`)
  - Rate limiting (IP/route, временная блокировка)
  - Структурированное логирование через `log/slog`

## Возможности

- Аутентификация и авторизация (роли `USER`/`MANAGER`)
- Регистрация заявок с валидацией
- Кабинет менеджера для управления заявками
- Прикрепление и скачивание файлов
- Поиск клиентов по ИНН

## Технологии

### Frontend (Next.js)
- TypeScript, React, React Query
- TailwindCSS
- React Hook Form

### Backend (Go)
- Go HTTP + Gorilla Mux
- PostgreSQL (pgx/v5)
- JWT (`golang-jwt/jwt/v5`), bcrypt
- `log/slog` для structured logging

## Локальная разработка

### Требования
- Node.js 18+ и npm
- Go 1.24+
- PostgreSQL 15+
- Docker и Docker Compose (опционально)

### Старт

1) Клонировать репозиторий
```bash
git clone https://github.com/eeephemera/zvk-requests.git
cd zvk-requests
```

2) Установить зависимости
```bash
# Frontend
cd client
npm install

# Backend
cd ../server
go mod download
```

3) Переменные окружения
```bash
# client/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8081

# server/.env (или переменные окружения)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=zvk_requests
JWT_SECRET=your_secret_key
APP_ENV=development
JWT_EXPIRATION=60m
REFRESH_EXPIRATION=720h
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=300
RATE_LIMIT_LOGIN_PER_MIN=20
```

4) Запуск в dev
```bash
# Frontend
cd client
npm run dev

# Backend
cd ../server
go run main.go
```

Откройте http://localhost:3000.

## Docker

Бэкенд: `server/Dockerfile` (multi‑stage, бинарник `main`).

Пример (в корне):
```bash
docker build -t zvk-requests-api ./server
docker run --env-file server/.env -p 8081:8081 zvk-requests-api
```

Если используете Compose, убедитесь, что фронтенд и бэкенд — отдельные сервисы (`client` и `api`), а Nginx/прокси отдает `SameSite=None; Secure` для cookie в проде.

## Примечания по безопасности

- Access‑token: `HttpOnly` cookie `token`, `SameSite=None`, `Secure` в проде
- Refresh‑token: `HttpOnly` cookie `refresh_token`, ротация + JTI‑blacklist
- CSRF: double‑submit (`csrf_token` cookie + `X-CSRF-Token` header)
- Rate limit: IP/маршрут, временная блокировка при превышении
- Пароли: bcrypt, авто‑rehash при входе при изменении cost

## Продакшн

Фронтенд — Vercel/статический хостинг. Бэкенд — любой контейнерный хостинг. Nginx/ingress должен проксировать `/api/*` и корректно передавать/экспонировать заголовки `Set-Cookie`.

## Лицензия

Proprietary. All rights reserved.