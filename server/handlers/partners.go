package handlers

import (
	"log"
	"net/http"

	"github.com/eeephemera/zvk-requests/db"
)

// PartnerHandler - обработчик запросов для работы с партнерами
type PartnerHandler struct {
	PartnerRepo *db.PartnerRepository
}

// NewPartnerHandler создает новый экземпляр PartnerHandler
func NewPartnerHandler(partnerRepo *db.PartnerRepository) *PartnerHandler {
	return &PartnerHandler{
		PartnerRepo: partnerRepo,
	}
}

// ListPartnersHandler обрабатывает запрос GET /api/partners
// и возвращает список всех партнеров
func (h *PartnerHandler) ListPartnersHandler(w http.ResponseWriter, r *http.Request) {
	// Получаем список партнеров из базы данных
	partners, err := h.PartnerRepo.GetAllPartners(r.Context())
	if err != nil {
		log.Printf("Error getting partners from database: %v", err)
		RespondWithError(w, http.StatusInternalServerError, "Ошибка при получении списка партнеров")
		return
	}

	// Возвращаем успешный ответ со списком партнеров
	RespondWithJSON(w, http.StatusOK, partners)
}
