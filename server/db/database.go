package db

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v4"
)

var conn *pgx.Conn

// ConnectDB устанавливает соединение с базой данных PostgreSQL.
func ConnectDB() {
	var err error
	conn, err = pgx.Connect(context.Background(), "postgres://postgres:1@localhost:5432/zvk_requests")
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	fmt.Println("Successfully connected to the database.")
}

// GetDBConnection возвращает текущее соединение с базой данных.
func GetDBConnection() *pgx.Conn {
	return conn
}

// CloseDBConnection закрывает соединение с базой данных.
func CloseDBConnection() {
	err := conn.Close(context.Background())
	if err != nil {
		log.Fatalf("Unable to close database connection: %v\n", err)
	}
	fmt.Println("Database connection closed.")
}
