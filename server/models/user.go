package models

import "time"

// UserRole определяет возможные роли пользователей как строки
type UserRole string

const (
	// RoleUser стандартная роль пользователя
	RoleUser UserRole = "USER"
	// RoleManager роль менеджера
	RoleManager UserRole = "MANAGER"
)

// User представляет пользователя системы
type User struct {
	ID           int       `json:"id"`
	Login        string    `json:"login"`
	PasswordHash string    `json:"-"`               // Не отправляем хеш пароля клиенту
	Name         string    `json:"name,omitempty"`  // Добавлено
	Email        string    `json:"email,omitempty"` // Добавлено
	Phone        string    `json:"phone,omitempty"` // Добавлено
	Role         UserRole  `json:"role"`
	PartnerID    *int      `json:"partner_id,omitempty"` // Добавлено (указатель, т.к. NULLABLE)
	CreatedAt    time.Time `json:"created_at"`

	// Можно оставить поле для связи, если нужно будет подгружать партнера
	Partner *Partner `json:"partner,omitempty"`
}
