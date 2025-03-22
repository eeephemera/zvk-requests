// models/request.go
package models

import "time"

type Request struct {
	ID                 int       `json:"id"`
	UserID             int       `json:"user_id"`
	INN                string    `json:"inn"`
	OrganizationName   string    `json:"organization_name"`
	ImplementationDate time.Time `json:"implementation_date"`
	FZType             string    `json:"fz_type"`
	RegistryType       string    `json:"registry_type"`
	Comment            string    `json:"comment"`
	TZFile             []byte    `json:"-"` // Поле не сериализуется в JSON
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}
