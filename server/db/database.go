package db

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	pool        *pgxpool.Pool
	connTimeout = 15 * time.Second
)

type Config struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// ConnectDB инициализирует соединение с базой данных
func ConnectDB(ctx context.Context) error {
	cfg := Config{
		Host:     os.Getenv("DB_HOST"),
		Port:     os.Getenv("DB_PORT"),
		User:     os.Getenv("DB_USER"),
		Password: os.Getenv("DB_PASSWORD"),
		DBName:   os.Getenv("DB_NAME"),
		SSLMode:  os.Getenv("DB_SSLMODE"),
	}

	connCtx, cancel := context.WithTimeout(ctx, connTimeout)
	defer cancel()

	connString := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return fmt.Errorf("failed to parse connection config: %w", err)
	}

	// Настройка пула соединений
	config.MaxConns = 25
	config.MinConns = 2
	config.MaxConnLifetime = 1 * time.Hour
	config.HealthCheckPeriod = 30 * time.Second

	pool, err = pgxpool.NewWithConfig(connCtx, config)
	if err != nil {
		return fmt.Errorf("database connection failed: %w", err)
	}

	// Дополнительная проверка соединения
	if err := pool.Ping(connCtx); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}

	return nil
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
