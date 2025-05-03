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