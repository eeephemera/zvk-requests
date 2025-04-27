package handlers

import (
	"log"
	"net/http"

	"github.com/eeephemera/zvk-requests/db"
)

// EndClientHandler - обработчик запросов для работы с конечными клиентами
type EndClientHandler struct {
	EndClientRepo *db.EndClientRepository
}

// NewEndClientHandler создает новый экземпляр EndClientHandler
func NewEndClientHandler(endClientRepo *db.EndClientRepository) *EndClientHandler {
	return &EndClientHandler{
		EndClientRepo: endClientRepo,
	}
}

// SearchByINNHandler обрабатывает запрос GET /api/end-clients/search?inn=...
// и возвращает информацию о конечном клиенте по его ИНН
func (h *EndClientHandler) SearchByINNHandler(w http.ResponseWriter, r *http.Request) {
	// Получаем параметр ИНН из запроса
	inn := r.URL.Query().Get("inn")
	if inn == "" {
		RespondWithError(w, http.StatusBadRequest, "Не указан параметр ИНН")
		return
	}

	// Ищем клиента по ИНН в базе данных
	endClient, err := h.EndClientRepo.FindEndClientByINN(r.Context(), inn)
	if err != nil {
		log.Printf("Error searching end client by INN: %v", err)
		RespondWithError(w, http.StatusInternalServerError, "Ошибка при поиске клиента по ИНН")
		return
	}

	// Если клиент не найден, возвращаем 404
	if endClient == nil {
		RespondWithError(w, http.StatusNotFound, "Клиент с указанным ИНН не найден")
		return
	}

	// Возвращаем успешный ответ с информацией о найденном клиенте
	RespondWithJSON(w, http.StatusOK, endClient)
}
