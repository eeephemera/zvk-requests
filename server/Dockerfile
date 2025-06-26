# Используем образ golang версии 1.23.5
FROM golang:1.23.5-alpine AS builder

WORKDIR /app

# Устанавливаем зависимости для компиляции
RUN apk add --no-cache gcc g++ make git

# Копируем go.mod и go.sum
COPY go.mod go.sum ./

# Загружаем зависимости
RUN go mod download

# Копируем исходный код
COPY . .

# Компилируем
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Конечный образ
FROM alpine:latest

WORKDIR /app

# Копируем скомпилированное приложение
COPY --from=builder /app/main .
COPY --from=builder /app/.env .

# Открываем порт
EXPOSE 8081

# Запускаем приложение
CMD ["./main"]
