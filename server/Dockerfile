# Используем образ golang версии 1.23.5
FROM golang:1.23.5-alpine AS builder

WORKDIR /app

# Устанавливаем зависимости для компиляции
RUN apk add --no-cache gcc g++ make git

# Устанавливаем migrate
RUN apk add --no-cache git && \
    GOBIN=/go/bin go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

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

# Устанавливаем make, чтобы можно было выполнять команды из Makefile
RUN apk add --no-cache make

WORKDIR /app

# Копируем скомпилированное приложение
COPY --from=builder /app/main .
# Копируем migrate ИЗ ЭТАПА СБОРКИ
COPY --from=builder /go/bin/migrate /usr/local/bin/

# Копируем Makefile и миграции ИЗ ЛОКАЛЬНОГО КОНТЕКСТА (папки server/)
# COPY Makefile .
COPY db/migrations ./db/migrations

# Открываем порт
EXPOSE 8081

# Запускаем приложение
CMD ["./main"]
