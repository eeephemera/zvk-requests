package db

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/eeephemera/zvk-requests/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// RequestRepository предоставляет методы для работы с таблицей requests.
type RequestRepository struct {
	pool *pgxpool.Pool
}

// NewRequestRepository создаёт новый RequestRepository, используя пул pgxpool.Pool.
func NewRequestRepository(pool *pgxpool.Pool) *RequestRepository {
	return &RequestRepository{pool: pool}
}

// CreateRequest вставляет новую заявку в таблицу requests.
func (repo *RequestRepository) CreateRequest(ctx context.Context, req *models.Request) error {
	query := `
        INSERT INTO requests (user_id, product_name, description, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at, updated_at
    `
	err := repo.pool.QueryRow(
		ctx,
		query,
		req.UserID,
		req.ProductName,
		req.Description,
		req.Status,
		time.Now(), // created_at
		time.Now(), // updated_at
	).Scan(&req.ID, &req.CreatedAt, &req.UpdatedAt)

	if err != nil {
		// Если в БД есть уникальный индекс, при конфликте будет ошибка "unique constraint"
		if strings.Contains(err.Error(), "unique constraint") {
			return fmt.Errorf("%w: product_name '%s'", ErrAlreadyExists, req.ProductName)
		}
		return fmt.Errorf("failed to create request: %w", err)
	}
	return nil
}

// GetRequestsByUser возвращает список заявок для конкретного пользователя (userID) с пагинацией.
func (repo *RequestRepository) GetRequestsByUser(
	ctx context.Context,
	userID int,
	limit, offset int,
) ([]models.Request, error) {

	query := `
        SELECT id, user_id, product_name, description, status, created_at, updated_at
        FROM requests
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
    `
	rows, err := repo.pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch requests: %w", err)
	}
	defer rows.Close()

	var requests []models.Request
	for rows.Next() {
		var req models.Request
		if err := rows.Scan(
			&req.ID,
			&req.UserID,
			&req.ProductName,
			&req.Description,
			&req.Status,
			&req.CreatedAt,
			&req.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan request: %w", err)
		}
		requests = append(requests, req)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return requests, nil
}

// GetRequestByID возвращает одну заявку по её ID и ID пользователя.
func (repo *RequestRepository) GetRequestByID(
	ctx context.Context,
	requestID, userID int,
) (*models.Request, error) {

	query := `
        SELECT id, user_id, product_name, description, status, created_at, updated_at
        FROM requests
        WHERE id = $1 AND user_id = $2
    `
	var req models.Request
	err := repo.pool.QueryRow(ctx, query, requestID, userID).Scan(
		&req.ID,
		&req.UserID,
		&req.ProductName,
		&req.Description,
		&req.Status,
		&req.CreatedAt,
		&req.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("%w: request id=%d", ErrNotFound, requestID)
		}
		return nil, fmt.Errorf("failed to fetch request: %w", err)
	}

	return &req, nil
}

// UpdateRequest обновляет существующую заявку для конкретного пользователя.
func (repo *RequestRepository) UpdateRequest(ctx context.Context, req *models.Request) error {
	query := `
        UPDATE requests
        SET product_name = $1,
            description = $2,
            status = $3,
            updated_at = $4
        WHERE id = $5 AND user_id = $6
    `
	result, err := repo.pool.Exec(
		ctx,
		query,
		req.ProductName,
		req.Description,
		req.Status,
		time.Now(), // Обновляем updated_at
		req.ID,
		req.UserID,
	)
	if err != nil {
		return fmt.Errorf("failed to update request: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("%w: request id=%d", ErrNotFound, req.ID)
	}

	return nil
}

// DeleteRequest удаляет заявку по её ID и ID пользователя.
func (repo *RequestRepository) DeleteRequest(ctx context.Context, requestID, userID int) error {
	query := `
        DELETE FROM requests
        WHERE id = $1 AND user_id = $2
    `
	result, err := repo.pool.Exec(ctx, query, requestID, userID)
	if err != nil {
		return fmt.Errorf("failed to delete request: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("%w: request id=%d", ErrNotFound, requestID)
	}

	return nil
}

// ========================
// Методы для менеджера
// ========================

// GetAllRequests возвращает список всех заявок (без фильтрации по user_id) с пагинацией.
func (repo *RequestRepository) GetAllRequests(ctx context.Context, limit, offset int) ([]models.Request, error) {
	query := `
        SELECT id, user_id, product_name, description, status, created_at, updated_at
        FROM requests
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
    `
	rows, err := repo.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch all requests: %w", err)
	}
	defer rows.Close()

	var requests []models.Request
	for rows.Next() {
		var req models.Request
		if err := rows.Scan(
			&req.ID,
			&req.UserID,
			&req.ProductName,
			&req.Description,
			&req.Status,
			&req.CreatedAt,
			&req.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan request: %w", err)
		}
		requests = append(requests, req)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return requests, nil
}

// GetRequestByIDWithoutUser возвращает заявку по её ID без фильтрации по user_id (для менеджера).
func (repo *RequestRepository) GetRequestByIDWithoutUser(ctx context.Context, requestID int) (*models.Request, error) {
	query := `
        SELECT id, user_id, product_name, description, status, created_at, updated_at
        FROM requests
        WHERE id = $1
    `
	var req models.Request
	err := repo.pool.QueryRow(ctx, query, requestID).Scan(
		&req.ID,
		&req.UserID,
		&req.ProductName,
		&req.Description,
		&req.Status,
		&req.CreatedAt,
		&req.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("%w: request id=%d", ErrNotFound, requestID)
		}
		return nil, fmt.Errorf("failed to fetch request: %w", err)
	}
	return &req, nil
}

// UpdateRequestWithoutUser обновляет заявку без фильтрации по user_id (для менеджера).
func (repo *RequestRepository) UpdateRequestWithoutUser(ctx context.Context, req *models.Request) error {
	query := `
        UPDATE requests
        SET product_name = $1,
            description = $2,
            status = $3,
            updated_at = $4
        WHERE id = $5
    `
	result, err := repo.pool.Exec(
		ctx,
		query,
		req.ProductName,
		req.Description,
		req.Status,
		time.Now(),
		req.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update request: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("%w: request id=%d", ErrNotFound, req.ID)
	}
	return nil
}

// DeleteRequestWithoutUser удаляет заявку по её ID без фильтрации по user_id (для менеджера).
func (repo *RequestRepository) DeleteRequestWithoutUser(ctx context.Context, requestID int) error {
	query := `
        DELETE FROM requests
        WHERE id = $1
    `
	result, err := repo.pool.Exec(ctx, query, requestID)
	if err != nil {
		return fmt.Errorf("failed to delete request: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("%w: request id=%d", ErrNotFound, requestID)
	}
	return nil
}
