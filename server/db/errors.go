// db/errors.go
package db

import "errors"

var (
	ErrAlreadyExists = errors.New("already exists")
	// ErrNotFound универсальная ошибка для не найденных записей.
	ErrNotFound = errors.New("record not found")
)
