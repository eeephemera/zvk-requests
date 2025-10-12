// db/errors.go
package db

import (
	"context"
	"errors"
	"strings"
	"time"

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

// RevocationStoreDB implements middleware.RevocationStore using this package's pool
type RevocationStoreDB struct{}

func (RevocationStoreDB) IsRevoked(ctx context.Context, jti string) (bool, error) {
	p := GetPool()
	if p == nil {
		return false, errors.New("db pool not initialized")
	}
	var exists bool
	err := p.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM revoked_tokens WHERE jti = $1 AND expires_at > NOW())`, jti).Scan(&exists)
	return exists, err
}

func (RevocationStoreDB) Revoke(ctx context.Context, jti string, expiresAt time.Time) error {
	p := GetPool()
	if p == nil {
		return errors.New("db pool not initialized")
	}
	_, err := p.Exec(ctx, `INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO UPDATE SET expires_at = EXCLUDED.expires_at`, jti, expiresAt)
	return err
}
