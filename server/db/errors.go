// db/errors.go
package db

import (
	"errors"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrAlreadyExists = errors.New("already exists")
	// ErrNotFound универсальная ошибка для не найденных записей.
	ErrNotFound = errors.New("record not found")
)

// IsUniqueConstraintViolation проверяет, является ли ошибка ошибкой
// нарушения уникальности для конкретного ключа.
func IsUniqueConstraintViolation(err error, constraintName string) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505" && strings.Contains(pgErr.ConstraintName, constraintName)
	}
	return false
}
