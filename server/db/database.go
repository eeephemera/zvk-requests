package db

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

var pool *pgxpool.Pool

// ConnectDB инициализирует соединение с базой данных.
func ConnectDB(ctx context.Context) {
	// Жестко заданная строка подключения
	dbURL := "postgres://postgres:1@localhost:5433/zvk_requests" // Замените на актуальные данные
	var err error

	pool, err = pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
}

// GetDBConnection возвращает пул соединений.
func GetDBConnection() *pgxpool.Pool {
	return pool
}

// CloseDBConnection закрывает пул соединений.
func CloseDBConnection() {
	if pool != nil {
		pool.Close()
	}
}
