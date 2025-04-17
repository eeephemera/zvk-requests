package db

import (
	"context"
	"fmt"
	"log"

	"github.com/eeephemera/zvk-requests/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserRepository предоставляет методы для работы с таблицей users.
type UserRepository struct {
	pool *pgxpool.Pool
}

// NewUserRepository создаёт новый UserRepository.
func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

// CreateUser вставляет нового пользователя в таблицу users.
// Важно: Хеширование пароля должно происходить *перед* вызовом этой функции.
func (repo *UserRepository) CreateUser(ctx context.Context, user *models.User) error {
	query := `
		INSERT INTO users (
			login, password_hash, role, partner_id, name, email, phone
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	// Преобразуем роль в строку для записи в БД
	roleStr := string(user.Role)

	err := repo.pool.QueryRow(ctx, query,
		user.Login, user.PasswordHash, roleStr, user.PartnerID,
		user.Name, user.Email, user.Phone,
	).Scan(&user.ID, &user.CreatedAt)

	if err != nil {
		// TODO: Добавить специфическую обработку ошибки UNIQUE constraint violation для login
		log.Printf("Error creating user with login %s: %v", user.Login, err)
		return fmt.Errorf("failed to create user: %w", err)
	}
	return nil
}

// GetUserByID возвращает пользователя по его ID.
func (repo *UserRepository) GetUserByID(ctx context.Context, id int) (*models.User, error) {
	query := `
		SELECT id, login, password_hash, role, partner_id, name, email, phone, created_at
		FROM users
		WHERE id = $1
	`
	var user models.User
	var roleStr string // Временная переменная для сканирования роли как строки

	err := repo.pool.QueryRow(ctx, query, id).Scan(
		&user.ID, &user.Login, &user.PasswordHash, &roleStr,
		&user.PartnerID, &user.Name, &user.Email, &user.Phone, &user.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			// Используем стандартную ошибку ErrNotFound, определенную в request_repository.go
			return nil, ErrNotFound
		}
		log.Printf("Error fetching user by ID %d: %v", id, err)
		return nil, fmt.Errorf("failed to fetch user by ID: %w", err)
	}

	// Преобразуем строку роли обратно в тип models.UserRole
	user.Role = models.UserRole(roleStr)
	// TODO: Добавить валидацию, что полученная роль соответствует допустимым значениям

	return &user, nil
}

// GetUserByLogin возвращает пользователя по его логину.
// Используется для проверки при входе в систему.
func (repo *UserRepository) GetUserByLogin(ctx context.Context, login string) (*models.User, error) {
	query := `
		SELECT id, login, password_hash, role, partner_id, name, email, phone, created_at
		FROM users
		WHERE login = $1
	`
	var user models.User
	var roleStr string

	err := repo.pool.QueryRow(ctx, query, login).Scan(
		&user.ID, &user.Login, &user.PasswordHash, &roleStr,
		&user.PartnerID, &user.Name, &user.Email, &user.Phone, &user.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			// Логин не найден - это не всегда ошибка уровня сервера,
			// но для внутреннего использования возвращаем ErrNotFound.
			return nil, ErrNotFound
		}
		log.Printf("Error fetching user by login %s: %v", login, err)
		return nil, fmt.Errorf("failed to fetch user by login: %w", err)
	}

	user.Role = models.UserRole(roleStr)
	// TODO: Добавить валидацию роли

	return &user, nil
}

// TODO: Добавить методы ListUsers, UpdateUser, DeleteUser по необходимости.
// TODO: Возможно, добавить метод для получения пользователя вместе с деталями партнера (JOIN).
// func (repo *UserRepository) GetUserWithPartnerDetails(ctx context.Context, id int) (*models.User, error) { ... }
