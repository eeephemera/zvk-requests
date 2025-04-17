package models

import "time"

// Product представляет товар в каталоге
type Product struct {
	ID          int       `json:"id"`
	SKU         string    `json:"sku"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	ItemType    string    `json:"item_type"`
	UnitPrice   *float64  `json:"unit_price,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
