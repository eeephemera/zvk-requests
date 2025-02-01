package db

import (
	"context"
	"errors"
	"time"

	"github.com/eeephemera/zvk-requests/models"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RequestRepository struct {
	pool *pgxpool.Pool
}

func NewRequestRepository(pool *pgxpool.Pool) *RequestRepository {
	return &RequestRepository{pool: pool}
}

// Создание нового запроса
func (repo *RequestRepository) CreateRequest(ctx context.Context, req *models.Request) error {
	query := `INSERT INTO requests (title, description, user_id, status, created_at)
			  VALUES ($1, $2, $3, $4, $5) RETURNING id`
	err := repo.pool.QueryRow(ctx, query, req.Title, req.Description, req.UserID, req.Status, time.Now()).Scan(&req.ID)
	return err
}

// Получение запросов пользователя
func (repo *RequestRepository) GetRequestsByUser(ctx context.Context, userID int) ([]models.Request, error) {
	query := `SELECT id, title, description, user_id, status, created_at FROM requests WHERE user_id = $1`
	rows, err := repo.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var requests []models.Request
	for rows.Next() {
		var req models.Request
		if err := rows.Scan(&req.ID, &req.Title, &req.Description, &req.UserID, &req.Status, &req.CreatedAt); err != nil {
			return nil, err
		}
		requests = append(requests, req)
	}
	return requests, nil
}

// Обновление запроса
func (repo *RequestRepository) UpdateRequest(ctx context.Context, req *models.Request) error {
	query := `UPDATE requests SET title = $1, description = $2, status = $3 WHERE id = $4 AND user_id = $5`
	commandTag, err := repo.pool.Exec(ctx, query, req.Title, req.Description, req.Status, req.ID, req.UserID)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return errors.New("request not found or not authorized")
	}
	return nil
}

// Удаление запроса
func (repo *RequestRepository) DeleteRequest(ctx context.Context, requestID, userID int) error {
	query := `DELETE FROM requests WHERE id = $1 AND user_id = $2`
	commandTag, err := repo.pool.Exec(ctx, query, requestID, userID)
	if err != nil {
		return err
	}
	if commandTag.RowsAffected() == 0 {
		return errors.New("request not found or not authorized")
	}
	return nil
}
