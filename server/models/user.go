package models

import "time"

// UserRole определяет возможные роли пользователей
type UserRole string

const (
	RoleManager UserRole = "Менеджер"
	RoleUser    UserRole = "Пользователь"
)

// User представляет пользователя системы
type User struct {
	ID        int       `json:"id"`
	Email     string    `json:"email"`
	Password  string    `json:"-"`
	Role      UserRole  `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}
