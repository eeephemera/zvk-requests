package db

import (
	"context"
	"fmt"
	"log"

	"github.com/eeephemera/zvk-requests/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ProductRepository предоставляет методы для работы с таблицей products.
type ProductRepository struct {
	pool *pgxpool.Pool
}

// NewProductRepository создаёт новый ProductRepository.
func NewProductRepository(pool *pgxpool.Pool) *ProductRepository {
	return &ProductRepository{pool: pool}
}

// CreateProduct вставляет новый продукт в таблицу products.
func (repo *ProductRepository) CreateProduct(ctx context.Context, product *models.Product) error {
	query := `
		INSERT INTO products (
			sku, name, description, item_type, unit_price
		) VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`
	err := repo.pool.QueryRow(ctx, query,
		product.SKU, product.Name, product.Description, product.ItemType, product.UnitPrice,
	).Scan(&product.ID, &product.CreatedAt, &product.UpdatedAt)

	if err != nil {
		// TODO: Добавить обработку уникальных ограничений (например, по SKU)
		log.Printf("Error creating product: %v", err)
		return fmt.Errorf("failed to create product: %w", err)
	}
	return nil
}

// GetProductByID возвращает продукт по его ID.
func (repo *ProductRepository) GetProductByID(ctx context.Context, id int) (*models.Product, error) {
	query := `
		SELECT id, sku, name, description, item_type, unit_price, created_at, updated_at
		FROM products
		WHERE id = $1
	`
	var product models.Product
	err := repo.pool.QueryRow(ctx, query, id).Scan(
		&product.ID, &product.SKU, &product.Name, &product.Description,
		&product.ItemType, &product.UnitPrice, &product.CreatedAt, &product.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("product not found: id=%d", id)
		}
		log.Printf("Error fetching product by ID %d: %v", id, err)
		return nil, fmt.Errorf("failed to fetch product: %w", err)
	}
	return &product, nil
}

// ListProducts возвращает список всех продуктов (без пагинации для простоты).
// В реальном приложении может понадобиться пагинация.
func (repo *ProductRepository) ListProducts(ctx context.Context) ([]models.Product, error) {
	query := `
		SELECT id, sku, name, description, item_type, unit_price, created_at, updated_at
		FROM products
		ORDER BY name ASC
	`
	rows, err := repo.pool.Query(ctx, query)
	if err != nil {
		log.Printf("Error querying products: %v", err)
		return nil, fmt.Errorf("failed to query products: %w", err)
	}
	defer rows.Close()

	products := []models.Product{}
	for rows.Next() {
		var product models.Product
		err := rows.Scan(
			&product.ID, &product.SKU, &product.Name, &product.Description,
			&product.ItemType, &product.UnitPrice, &product.CreatedAt, &product.UpdatedAt,
		)
		if err != nil {
			log.Printf("Error scanning product row: %v", err)
			// Продолжаем сканирование остальных строк, но возвращаем ошибку в конце
			return nil, fmt.Errorf("failed to scan product: %w", err)
		}
		products = append(products, product)
	}

	if err = rows.Err(); err != nil {
		log.Printf("Error after iterating product rows: %v", err)
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}

	return products, nil
}

// TODO: Добавить методы UpdateProduct, DeleteProduct, FindProductBySKU по необходимости.
