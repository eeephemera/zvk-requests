.PHONY: test test-short test-verbose test-coverage test-all format check-security

# Запуск всех тестов
test:
	go test ./...

# Запуск быстрых тестов (пропускаются длительные тесты)
test-short:
	go test -short ./...

# Запуск тестов с подробным выводом
test-verbose:
	go test -v ./...

# Запуск тестов с покрытием
test-coverage:
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated at coverage.html"

# Запуск всех тестов и генерация отчетов
test-all: format check-security test test-coverage
	@echo "All tests completed"

# Форматирование кода
format:
	go fmt ./...
	@echo "Code formatted"

# Проверка безопасности
check-security:
	@echo "Running security checks..."
	@if command -v gosec > /dev/null; then \
		gosec ./...; \
	else \
		echo "gosec not installed. To install, run: go install github.com/securego/gosec/v2/cmd/gosec@latest"; \
	fi

# Запуск тестов для конкретного пакета
test-package:
	@if [ -z "$(PKG)" ]; then \
		echo "Usage: make test-package PKG=<package-path>"; \
		exit 1; \
	fi
	go test -v $(PKG)

# Запуск conkурентных тестов
test-race:
	go test -race ./...

# Запуск тестов безопасности
test-security:
	go test -v -tags=security ./...

# Очистка артефактов тестирования
clean:
	rm -f coverage.out coverage.html

# Запуск приложения (для разработки)
run:
	go run main.go

# Сборка production-версии
build:
	go build -ldflags="-s -w" -o server main.go

docker-run: ## Запустить приложение в Docker-контейнере
	docker run --rm -p $(SERVER_PORT):$(SERVER_PORT) --name $(APP_NAME)-container $(APP_NAME)

.PHONY: db-up db-down db-restart db-logs

# --- Database Docker ---
DB_CONTAINER_NAME = zvk-postgres-db

db-up: ## Запустить контейнер с PostgreSQL
	docker run --name $(DB_CONTAINER_NAME) -e POSTGRES_USER=$(DB_USER) -e POSTGRES_PASSWORD=$(DB_PASSWORD) -e POSTGRES_DB=$(DB_NAME) -p $(DB_PORT):5432 -d postgres:15

db-down: ## Остановить и удалить контейнер с PostgreSQL
	docker stop $(DB_CONTAINER_NAME) || true
	docker rm $(DB_CONTAINER_NAME) || true

db-restart: ## Перезапустить контейнер с PostgreSQL
	$(MAKE) db-down
	$(MAKE) db-up

db-logs: ## Посмотреть логи контейнера PostgreSQL
	docker logs -f $(DB_CONTAINER_NAME)
	
# --- Migrations ---
MIGRATE_PATH = ./db/migrations
# Собираем строку подключения из переменных окружения
# Убедитесь, что .env файл существует или переменные установлены в системе
DB_URL = "postgres://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=disable"

migrate-create: ## Создать новый файл миграции (например, make migrate-create name=add_new_table)
	@migrate create -ext sql -dir $(MIGRATE_PATH) -seq $(name)

migrate-up: ## Применить все доступные миграции
	@echo "Applying migrations..."
	@migrate -database $(DB_URL) -path $(MIGRATE_PATH) up

migrate-down: ## Откатить последнюю примененную миграцию
	@echo "Reverting last migration..."
	@migrate -database $(DB_URL) -path $(MIGRATE_PATH) down

.PHONY: help
help: ## Показать это сообщение 