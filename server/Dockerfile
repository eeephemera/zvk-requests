# Используем образ golang версии 1.23.5
FROM golang:1.23.5-alpine AS builder

WORKDIR /app

# Устанавливаем зависимости для компиляции
RUN apk add --no-cache gcc g++ make git

# (ИСКЛЮЧЕНО) Сборка migrate из исходников сильно замедляет билд.
# Оставляем установку migrate в финальном слое через скачивание готового бинарника.

# Кэшируем зависимости
COPY go.mod go.sum ./

# Загружаем зависимости
RUN go mod download

# Копируем исходный код
COPY . .

# Компилируем
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Конечный образ
FROM alpine:latest

# Устанавливаем make и curl (curl нужен для healthcheck'ов и загрузки migrate)
RUN apk add --no-cache make curl

WORKDIR /app

# Копируем скомпилированное приложение
COPY --from=builder /app/main .
# Скачиваем готовый бинарник migrate (linux-amd64)
RUN set -eux; \
    mkdir -p /usr/local/bin; \
    curl -fsSL -o /tmp/migrate.tgz \
      https://github.com/golang-migrate/migrate/releases/download/v4.16.2/migrate.linux-amd64.tar.gz; \
    tar -xzf /tmp/migrate.tgz -C /usr/local/bin; \
    mv /usr/local/bin/migrate.linux-amd64 /usr/local/bin/migrate; \
    chmod +x /usr/local/bin/migrate; \
    rm -f /tmp/migrate.tgz

# Копируем Makefile и миграции ИЗ ЛОКАЛЬНОГО КОНТЕКСТА (папки server/)
# COPY Makefile .
COPY db/migrations ./db/migrations

# Открываем порт
EXPOSE 8081

# Запускаем приложение
CMD ["./main"]
