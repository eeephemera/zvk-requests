package models

import "time"

type Request struct {
	ID          int       `json:"id"`
	UserID      int       `json:"user_id"`
	ProductName string    `json:"product_name"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
