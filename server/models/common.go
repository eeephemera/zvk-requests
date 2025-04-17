// server/models/common.go
package models

// PaginatedResponse - общая структура для пагинированных ответов API
type PaginatedResponse struct {
	Items interface{} `json:"items"` // Используем interface{} для универсальности
	Total int64       `json:"total"`
	Page  int         `json:"page"`
	Limit int         `json:"limit"`
}
