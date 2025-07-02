package db

import (
	"context"
	"fmt"

	"github.com/eeephemera/zvk-requests/server/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PartnerRepository предоставляет методы для работы с таблицей partners.
type PartnerRepository struct {
	pool *pgxpool.Pool
}

// NewPartnerRepository создаёт новый PartnerRepository.
func NewPartnerRepository(pool *pgxpool.Pool) *PartnerRepository {
	return &PartnerRepository{pool: pool}
}

// CreatePartner вставляет нового партнера в таблицу partners.
func (repo *PartnerRepository) CreatePartner(ctx context.Context, partner *models.Partner) error {
	query := `
        INSERT INTO partners (
            name, address, inn, partner_status, assigned_manager_id
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at, updated_at
    `
	return repo.pool.QueryRow(ctx, query,
		partner.Name, partner.Address, partner.INN, partner.PartnerStatus, partner.AssignedManagerID,
	).Scan(&partner.ID, &partner.CreatedAt, &partner.UpdatedAt)
}

// GetPartnerByID возвращает партнера по его ID.
func (repo *PartnerRepository) GetPartnerByID(ctx context.Context, id int) (*models.Partner, error) {
	query := `
        SELECT id, name, address, inn, partner_status, assigned_manager_id, created_at, updated_at
        FROM partners
        WHERE id = $1
    `
	var partner models.Partner
	err := repo.pool.QueryRow(ctx, query, id).Scan(
		&partner.ID, &partner.Name, &partner.Address, &partner.INN,
		&partner.PartnerStatus, &partner.AssignedManagerID, &partner.CreatedAt, &partner.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("partner not found: id=%d", id)
		}
		return nil, fmt.Errorf("failed to fetch partner: %w", err)
	}
	return &partner, nil
}

// GetAllPartners возвращает список всех партнеров.
func (repo *PartnerRepository) GetAllPartners(ctx context.Context) ([]*models.Partner, error) {
	query := `
        SELECT id, name, address, inn, partner_status, assigned_manager_id, created_at, updated_at
        FROM partners
        ORDER BY name ASC
    `
	rows, err := repo.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query partners: %w", err)
	}
	defer rows.Close()

	var partners []*models.Partner
	for rows.Next() {
		var partner models.Partner
		err := rows.Scan(
			&partner.ID, &partner.Name, &partner.Address, &partner.INN,
			&partner.PartnerStatus, &partner.AssignedManagerID, &partner.CreatedAt, &partner.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan partner row: %w", err)
		}
		partners = append(partners, &partner)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating partner rows: %w", err)
	}
	return partners, nil
}

// Другие методы по аналогии с RequestRepository...
