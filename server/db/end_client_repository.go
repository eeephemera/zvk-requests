package db

import (
	"context"
	"fmt"
	"log"

	"github.com/eeephemera/zvk-requests/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EndClientRepository предоставляет методы для работы с таблицей end_clients.
type EndClientRepository struct {
	pool *pgxpool.Pool
}

// NewEndClientRepository создаёт новый EndClientRepository.
func NewEndClientRepository(pool *pgxpool.Pool) *EndClientRepository {
	return &EndClientRepository{pool: pool}
}

// CreateEndClient вставляет нового конечного клиента в таблицу end_clients.
// Возвращает созданный объект EndClient с ID и временными метками.
func (repo *EndClientRepository) CreateEndClient(ctx context.Context, client *models.EndClient) error {
	query := `
		INSERT INTO end_clients (
			name, city, inn, full_address, contact_person_details
		) VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`
	err := repo.pool.QueryRow(ctx, query,
		client.Name, client.City, client.INN, client.FullAddress, client.ContactPersonDetails,
	).Scan(&client.ID, &client.CreatedAt, &client.UpdatedAt)

	if err != nil {
		// TODO: Добавить обработку уникальных ограничений (например, по ИНН)
		log.Printf("Error creating end client: %v", err)
		return fmt.Errorf("failed to create end client: %w", err)
	}
	return nil
}

// GetEndClientByID возвращает конечного клиента по его ID.
func (repo *EndClientRepository) GetEndClientByID(ctx context.Context, id int) (*models.EndClient, error) {
	query := `
		SELECT id, name, city, inn, full_address, contact_person_details, created_at, updated_at
		FROM end_clients
		WHERE id = $1
	`
	var client models.EndClient
	err := repo.pool.QueryRow(ctx, query, id).Scan(
		&client.ID, &client.Name, &client.City, &client.INN,
		&client.FullAddress, &client.ContactPersonDetails, &client.CreatedAt, &client.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			// Используем более специфичную ошибку, если нужно
			// return nil, ErrNotFound
			return nil, fmt.Errorf("end client not found: id=%d", id)
		}
		log.Printf("Error fetching end client by ID %d: %v", id, err)
		return nil, fmt.Errorf("failed to fetch end client: %w", err)
	}
	return &client, nil
}

// FindEndClientByINN ищет конечного клиента по ИНН.
// Может вернуть nil, nil, если клиент не найден.
func (repo *EndClientRepository) FindEndClientByINN(ctx context.Context, inn string) (*models.EndClient, error) {
	if inn == "" { // Не ищем по пустому ИНН
		return nil, nil
	}
	query := `
		SELECT id, name, city, inn, full_address, contact_person_details, created_at, updated_at
		FROM end_clients
		WHERE inn = $1
		LIMIT 1 
	` // LIMIT 1 на всякий случай, хотя ИНН должен быть UNIQUE
	var client models.EndClient
	err := repo.pool.QueryRow(ctx, query, inn).Scan(
		&client.ID, &client.Name, &client.City, &client.INN,
		&client.FullAddress, &client.ContactPersonDetails, &client.CreatedAt, &client.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // Не найдено - это не ошибка в данном контексте
		}
		log.Printf("Error finding end client by INN %s: %v", inn, err)
		return nil, fmt.Errorf("failed to find end client by INN: %w", err)
	}
	return &client, nil
}

// TODO: Добавить методы ListEndClients, UpdateEndClient, DeleteEndClient по необходимости.
