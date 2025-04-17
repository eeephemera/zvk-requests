package models

import "time"

// EndClient представляет организацию-конечного заказчика
type EndClient struct {
	ID                   int       `json:"id"`
	Name                 string    `json:"name"`
	City                 string    `json:"city,omitempty"`
	INN                  string    `json:"inn,omitempty"`
	FullAddress          string    `json:"full_address,omitempty"`
	ContactPersonDetails string    `json:"contact_person_details,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}
