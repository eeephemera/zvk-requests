FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package.json и package-lock.json
COPY client/package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходники
COPY client/ ./

# Собираем приложение
RUN npm run build

# Конечный образ с минимальными зависимостями
FROM node:20-alpine AS runner

WORKDIR /app

# Переменные окружения
ENV NODE_ENV=production

# Копируем необходимые файлы из образа builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.js ./

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "run", "start"]
