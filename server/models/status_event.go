package models

import "time"

// StatusEvent представляет событие в истории изменения статуса заявки.
type StatusEvent struct {
	Status    string    `json:"status"`
	ChangedAt time.Time `json:"changed_at"`
	Comment   *string   `json:"comment,omitempty"`
	ManagerID *int      `json:"manager_id,omitempty"`
}
