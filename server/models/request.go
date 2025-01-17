package models

import (
	"time"
)

// Request представляет данные запроса в системе.
type Request struct {
	ID        int       `json:"id"`         // ID запроса
	Customer  string    `json:"customer"`   // Имя клиента
	Product   string    `json:"product"`    // Название продукта
	Status    string    `json:"status"`     // Статус запроса
	CreatedAt time.Time `json:"created_at"` // Время создания
	UpdatedAt time.Time `json:"updated_at"` // Время последнего обновления
}
