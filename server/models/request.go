package models

import "time"

// Request представляет заявку на регистрацию проекта
type Request struct {
	ID                       int        `json:"id"`
	PartnerUserID            int        `json:"partner_user_id"`
	PartnerID                int        `json:"partner_id"`
	EndClientID              *int       `json:"end_client_id,omitempty"`
	EndClientDetailsOverride *string    `json:"end_client_details_override,omitempty"`
	DistributorID            *int       `json:"distributor_id,omitempty"`
	PartnerContactOverride   *string    `json:"partner_contact_override,omitempty"`
	FZLawType                *string    `json:"fz_law_type,omitempty"`
	MPTRegistryType          *string    `json:"mpt_registry_type,omitempty"`
	PartnerActivities        *string    `json:"partner_activities,omitempty"`
	DealStateDescription     *string    `json:"deal_state_description,omitempty"`
	EstimatedCloseDate       *time.Time `json:"estimated_close_date,omitempty"`
	OverallTZFile            []byte     `json:"overall_tz_file,omitempty"`
	Status                   string     `json:"status"`
	ManagerComment           *string    `json:"manager_comment,omitempty"`
	CreatedAt                time.Time  `json:"created_at"`
	UpdatedAt                time.Time  `json:"updated_at"`

	// Связанные данные
	Partner     *Partner      `json:"partner,omitempty"`
	EndClient   *EndClient    `json:"end_client,omitempty"`
	Distributor *Partner      `json:"distributor,omitempty"`
	User        *User         `json:"user,omitempty"`
	Items       []RequestItem `json:"items,omitempty"`
}
