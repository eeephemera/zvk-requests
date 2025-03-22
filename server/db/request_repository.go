package db

import (
	"context"
	"fmt"
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
		INSERT INTO requests (
			user_id, inn, organization_name, implementation_date, fz_type, 
			registry_type, comment, tz_file, status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at
	`
	return repo.pool.QueryRow(ctx, query,
		req.UserID, req.INN, req.OrganizationName, req.ImplementationDate, req.FZType,
		req.RegistryType, req.Comment, req.TZFile, req.Status,
	).Scan(&req.ID, &req.CreatedAt, &req.UpdatedAt)
}

// GetRequestsByUser возвращает список заявок для конкретного пользователя (userID) с пагинацией.
func (repo *RequestRepository) GetRequestsByUser(
	ctx context.Context,
	userID int,
	limit, offset int,
) ([]models.Request, error) {
	query := `
		SELECT id, user_id, inn, organization_name, implementation_date, fz_type, 
			   registry_type, comment, tz_file, status, created_at, updated_at
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
			&req.ID, &req.UserID, &req.INN, &req.OrganizationName, &req.ImplementationDate,
			&req.FZType, &req.RegistryType, &req.Comment, &req.TZFile, &req.Status,
			&req.CreatedAt, &req.UpdatedAt,
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
		SELECT id, user_id, inn, organization_name, implementation_date, fz_type, 
			   registry_type, comment, tz_file, status, created_at, updated_at
		FROM requests
		WHERE id = $1 AND user_id = $2
	`
	var req models.Request
	err := repo.pool.QueryRow(ctx, query, requestID, userID).Scan(
		&req.ID, &req.UserID, &req.INN, &req.OrganizationName, &req.ImplementationDate,
		&req.FZType, &req.RegistryType, &req.Comment, &req.TZFile, &req.Status,
		&req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("request not found: id=%d", requestID)
		}
		return nil, fmt.Errorf("failed to fetch request: %w", err)
	}
	return &req, nil
}

// UpdateRequest обновляет существующую заявку для конкретного пользователя.
func (repo *RequestRepository) UpdateRequest(ctx context.Context, req *models.Request) error {
	query := `
		UPDATE requests
		SET inn = $1,
			organization_name = $2,
			implementation_date = $3,
			fz_type = $4,
			registry_type = $5,
			comment = $6,
			tz_file = $7,
			status = $8,
			updated_at = $9
		WHERE id = $10 AND user_id = $11
	`
	result, err := repo.pool.Exec(ctx, query,
		req.INN, req.OrganizationName, req.ImplementationDate, req.FZType,
		req.RegistryType, req.Comment, req.TZFile, req.Status, time.Now(),
		req.ID, req.UserID,
	)
	if err != nil {
		return fmt.Errorf("failed to update request: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("request not found: id=%d", req.ID)
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
		return fmt.Errorf("request not found: id=%d", requestID)
	}
	return nil
}

// GetAllRequests возвращает список всех заявок (без фильтрации по user_id) с пагинацией.
func (repo *RequestRepository) GetAllRequests(ctx context.Context, limit, offset int) ([]models.Request, error) {
	query := `
		SELECT id, user_id, inn, organization_name, implementation_date, fz_type, 
			   registry_type, comment, tz_file, status, created_at, updated_at
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
			&req.ID, &req.UserID, &req.INN, &req.OrganizationName, &req.ImplementationDate,
			&req.FZType, &req.RegistryType, &req.Comment, &req.TZFile, &req.Status,
			&req.CreatedAt, &req.UpdatedAt,
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
		SELECT id, user_id, inn, organization_name, implementation_date, fz_type, 
			   registry_type, comment, tz_file, status, created_at, updated_at
		FROM requests
		WHERE id = $1
	`
	var req models.Request
	err := repo.pool.QueryRow(ctx, query, requestID).Scan(
		&req.ID, &req.UserID, &req.INN, &req.OrganizationName, &req.ImplementationDate,
		&req.FZType, &req.RegistryType, &req.Comment, &req.TZFile, &req.Status,
		&req.CreatedAt, &req.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("request not found: id=%d", requestID)
		}
		return nil, fmt.Errorf("failed to fetch request: %w", err)
	}
	return &req, nil
}

// UpdateRequestWithoutUser обновляет заявку без фильтрации по user_id (для менеджера).
func (repo *RequestRepository) UpdateRequestWithoutUser(ctx context.Context, req *models.Request) error {
	query := `
		UPDATE requests
		SET inn = $1,
			organization_name = $2,
			implementation_date = $3,
			fz_type = $4,
			registry_type = $5,
			comment = $6,
			tz_file = $7,
			status = $8,
			updated_at = $9
		WHERE id = $10
	`
	result, err := repo.pool.Exec(ctx, query,
		req.INN, req.OrganizationName, req.ImplementationDate, req.FZType,
		req.RegistryType, req.Comment, req.TZFile, req.Status, time.Now(),
		req.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update request: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("request not found: id=%d", req.ID)
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
		return fmt.Errorf("request not found: id=%d", requestID)
	}
	return nil
}
