package models

import "time"

// Partner представляет организацию-партнера
type Partner struct {
	ID                int       `json:"id"`
	Name              string    `json:"name"`
	Address           string    `json:"address,omitempty"`
	INN               string    `json:"inn,omitempty"`
	PartnerStatus     string    `json:"partner_status,omitempty"`
	AssignedManagerID *int      `json:"assigned_manager_id,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
