package requests

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/eeephemera/zvk-requests/server/db"
	"github.com/eeephemera/zvk-requests/server/handlers"
	"github.com/eeephemera/zvk-requests/server/middleware"
	"github.com/eeephemera/zvk-requests/server/models"
	"github.com/gorilla/mux"
)

// Структура для ответа с пагинацией
type PaginatedRequestsResponse struct {
	Items []models.Request `json:"items"`
	Total int64            `json:"total"` // Используем int64 для совместимости с COUNT(*)
}

// UpdateRequestStatusHandler - обновление статуса заявки менеджером
func (h *RequestHandler) UpdateRequestStatusHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Получаем ID менеджера из контекста
	managerID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "Manager not authenticated")
		return
	}

	// 2. Получаем ID заявки из URL
	vars := mux.Vars(r)
	requestIDStr := vars["id"]
	requestID, err := strconv.Atoi(requestIDStr)
	if err != nil || requestID <= 0 {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request ID format")
		return
	}

	// 3. Декодируем тело запроса (ожидаем JSON с новым статусом и комментарием)
	var payload struct {
		Status  models.RequestStatus `json:"status"`
		Comment string               `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 4. Проверяем, что статус валиден
	if !isValidRequestStatus(payload.Status) {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid status value")
		return
	}

	// 5. Проверяем права доступа менеджера к этой заявке
	hasAccess, err := h.Repo.CheckManagerAccess(r.Context(), managerID, requestID)
	if err != nil {
		log.Printf("UpdateRequestStatusHandler: Error checking manager access for manager %d, request %d: %v", managerID, requestID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to check access rights")
		return
	}
	if !hasAccess {
		handlers.RespondWithError(w, http.StatusForbidden, "Manager does not have permission to modify this request")
		return
	}

	// 6. Обновляем статус в репозитории
	err = h.Repo.UpdateRequestStatus(r.Context(), requestID, payload.Status, &payload.Comment)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("UpdateRequestStatusHandler: Error updating status for request %d: %v", requestID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to update request status")
		return
	}

	// 7. Отправляем успешный ответ (можно вернуть обновленную заявку, если нужно)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Request status updated successfully"})
}

// ListManagerRequestsHandler - получение списка заявок для менеджера (пагинация, фильтры, сортировка)
func (h *RequestHandler) ListManagerRequestsHandler(w http.ResponseWriter, r *http.Request) {
	managerID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "Manager not authenticated")
		return
	}

	// Получаем параметры пагинации, фильтрации и сортировки из query string
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")
	statusFilterStr := r.URL.Query().Get("status")
	partnerFilter := r.URL.Query().Get("organization_name")
	clientFilter := r.URL.Query().Get("client")
	sortBy := r.URL.Query().Get("sortBy")
	sortOrder := r.URL.Query().Get("sortOrder") // ASC или DESC

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1
	}
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 {
		limit = 10
	}
	offset := (page - 1) * limit

	var statusFilter models.RequestStatus
	if statusFilterStr != "" {
		statusFilter = models.RequestStatus(statusFilterStr)
		if !isValidRequestStatus(statusFilter) {
			handlers.RespondWithError(w, http.StatusBadRequest, "Invalid status filter value")
			return
		}
	}

	// Вызываем метод репозитория со всеми параметрами
	requests, total, err := h.Repo.ListRequestsForManager(
		r.Context(), managerID, limit, offset,
		statusFilter, partnerFilter, clientFilter,
		sortBy, sortOrder,
	)
	if err != nil {
		log.Printf("ListManagerRequestsHandler: Error fetching requests for manager %d: %v", managerID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to fetch requests")
		return
	}

	// Используем общую структуру PaginatedResponse (она должна быть определена в models или handlers)
	// Предположим, она в models для консистентности
	response := models.PaginatedResponse{
		Items: requests, // ListRequestsForManager возвращает срез models.Request
		Total: total,
		Page:  page,
		Limit: limit,
	}

	handlers.RespondWithJSON(w, http.StatusOK, response)
}

// GetManagerRequestDetailsHandler - получение деталей заявки менеджером
func (h *RequestHandler) GetManagerRequestDetailsHandler(w http.ResponseWriter, r *http.Request) {
	managerID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "Manager not authenticated")
		return
	}

	vars := mux.Vars(r)
	requestIDStr := vars["id"]
	requestID, err := strconv.Atoi(requestIDStr)
	if err != nil || requestID <= 0 {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request ID format")
		return
	}

	// Проверяем права доступа менеджера к этой заявке
	hasAccess, err := h.Repo.CheckManagerAccess(r.Context(), managerID, requestID)
	if err != nil {
		log.Printf("GetManagerRequestDetailsHandler: Error checking manager access for manager %d, request %d: %v", managerID, requestID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to check access rights")
		return
	}
	if !hasAccess {
		handlers.RespondWithError(w, http.StatusForbidden, "Manager does not have permission to view this request")
		return
	}

	// Получаем детали заявки
	req, err := h.Repo.GetRequestDetailsByID(r.Context(), requestID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("GetManagerRequestDetailsHandler: Error fetching details for request %d: %v", requestID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to fetch request details")
		return
	}

	handlers.RespondWithJSON(w, http.StatusOK, req)
}

// DeleteManagerRequestHandler - удаление заявки менеджером
func (h *RequestHandler) DeleteManagerRequestHandler(w http.ResponseWriter, r *http.Request) {
	managerID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "Manager not authenticated")
		return
	}

	vars := mux.Vars(r)
	requestIDStr := vars["id"]
	requestID, err := strconv.Atoi(requestIDStr)
	if err != nil || requestID <= 0 {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request ID format")
		return
	}

	// Проверяем права доступа
	hasAccess, err := h.Repo.CheckManagerAccess(r.Context(), managerID, requestID)
	if err != nil {
		log.Printf("DeleteManagerRequestHandler: Error checking manager access for manager %d, request %d: %v", managerID, requestID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to check access rights")
		return
	}
	if !hasAccess {
		handlers.RespondWithError(w, http.StatusForbidden, "Manager does not have permission to delete this request")
		return
	}

	// Удаляем заявку
	err = h.Repo.DeleteRequest(r.Context(), requestID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("DeleteManagerRequestHandler: Error deleting request %d: %v", requestID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to delete request")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// DownloadRequestHandler - УСТАРЕЛО. Будет удалено.
// func (h *RequestHandler) DownloadRequestHandler(w http.ResponseWriter, r *http.Request) {
// ...
// }

// isValidRequestStatus проверяет, является ли переданный статус одним из допустимых.
// Используем карту для быстрой проверки.
func isValidRequestStatus(status models.RequestStatus) bool {
	switch status {
	case
		"На рассмотрении",
		"В работе",
		"На уточнении",
		"Одобрена",
		"Отклонена",
		"Завершена":
		return true
	default:
		return false
	}
}
