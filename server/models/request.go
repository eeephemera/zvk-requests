package models

import (
	"time"

	"github.com/shopspring/decimal"
)

// RequestStatus определяет возможные статусы заявок
type RequestStatus string

const (
	StatusPending    RequestStatus = "На рассмотрении"
	StatusApproved   RequestStatus = "Одобрено"
	StatusRejected   RequestStatus = "Отклонено"
	StatusClarify    RequestStatus = "Требует уточнения"
	StatusInProgress RequestStatus = "В работе"
	StatusCompleted  RequestStatus = "Выполнено"
)

// Request представляет основную сущность "Заявка на регистрацию сделки".
type Request struct {
	ID                       int           `json:"id"`
	PartnerUserID            int           `json:"partner_user_id"`
	PartnerID                int           `json:"partner_id"`
	EndClientID              *int          `json:"end_client_id,omitempty"`
	EndClientDetailsOverride *string       `json:"end_client_details_override,omitempty"`
	DistributorID            *int          `json:"distributor_id,omitempty"`
	PartnerContactOverride   *string       `json:"partner_contact_override,omitempty"`
	FZLawType                *string       `json:"fz_law_type,omitempty"`
	MPTRegistryType          *string       `json:"mpt_registry_type,omitempty"`
	PartnerActivities        *string       `json:"partner_activities,omitempty"`
	DealStateDescription     *string       `json:"deal_state_description,omitempty"`
	EstimatedCloseDate       *time.Time    `json:"estimated_close_date,omitempty"`
	Status                   RequestStatus `json:"status"`
	ManagerComment           *string       `json:"manager_comment,omitempty"`
	CreatedAt                time.Time     `json:"created_at"`
	UpdatedAt                time.Time     `json:"updated_at"`

	// Новые поля, перенесенные из request_items и добавленные
	ProjectName *string          `json:"project_name,omitempty"`
	Quantity    *int             `json:"quantity,omitempty"`
	UnitPrice   *decimal.Decimal `json:"unit_price,omitempty"`
	TotalPrice  *decimal.Decimal `json:"total_price,omitempty"`

	// Связанные данные (вложенные объекты)
	Partner     *Partner   `json:"partner,omitempty"`
	EndClient   *EndClient `json:"end_client,omitempty"`
	Distributor *Partner   `json:"distributor,omitempty"` // Дистрибьютор - это тоже партнер
	User        *User      `json:"user,omitempty"`

	// Новое поле для хранения нескольких файлов
	Files []*File `json:"files,omitempty"`

	// Поля для агрегации, которые не хранятся в таблице напрямую
	TotalSum *decimal.Decimal `json:"total_sum,omitempty"`
}
