package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	pool *pgxpool.Pool
)

// ConnectDB устанавливает соединение с базой данных PostgreSQL.
// Использует повторные попытки с экспоненциальной задержкой.
func ConnectDB(ctx context.Context) error {
	sslMode := os.Getenv("DB_SSLMODE")
	if sslMode == "" {
		sslMode = "disable"
	}
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		sslMode,
	)

	maxAttempts := 10
	currentAttempt := 0
	for {
		currentAttempt++
		log.Printf("Попытка подключения к базе данных %d из %d...", currentAttempt, maxAttempts)
		var err error
		pool, err = pgxpool.New(ctx, connStr)
		if err == nil {
			err = pool.Ping(ctx)
		}

		if err == nil {
			log.Println("Успешное подключение к базе данных!")
			return nil
		}

		log.Printf("Ошибка подключения к базе данных: %v", err)
		if currentAttempt >= maxAttempts {
			return fmt.Errorf("не удалось подключиться к базе данных после %d попыток: %w", maxAttempts, err)
		}

		// Экспоненциальная задержка
		time.Sleep(time.Duration(currentAttempt) * time.Second)
	}
}

// GetPool возвращает глобальный пул соединений
func GetPool() *pgxpool.Pool {
	return pool
}

// GetDBConnection возвращает соединение из пула
func GetDBConnection(ctx context.Context) (*pgxpool.Conn, error) {
	if pool == nil {
		return nil, fmt.Errorf("connection pool is not initialized")
	}

	conn, err := pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to acquire connection: %w", err)
	}

	return conn, nil
}

// CloseDBConnection закрывает пул соединений
func CloseDBConnection() {
	if pool != nil {
		pool.Close()
	}
}
