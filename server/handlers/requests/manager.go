package requests

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/eeephemera/zvk-requests/db"
	"github.com/eeephemera/zvk-requests/handlers"
	"github.com/eeephemera/zvk-requests/middleware"
	"github.com/eeephemera/zvk-requests/models"
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
		Status  string `json:"status"`
		Comment string `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 4. Проверяем, что статус валиден (можно добавить больше проверок)
	if payload.Status == "" {
		handlers.RespondWithError(w, http.StatusBadRequest, "Status cannot be empty")
		return
	}
	// TODO: Добавить валидацию на допустимые значения статуса

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
	err = h.Repo.UpdateRequestStatus(r.Context(), requestID, payload.Status, payload.Comment)
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
	statusFilter := r.URL.Query().Get("status")
	partnerFilter := r.URL.Query().Get("partner")
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

	// Вызываем метод репозитория со всеми параметрами
	requests, total, err := h.Repo.ListRequestsByManager(
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
		Items: requests, // ListRequestsByManager возвращает срез models.Request
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

// DownloadRequestHandler - скачивание файла ТЗ (доступно и пользователю, и менеджеру с проверкой прав)
func (h *RequestHandler) DownloadRequestHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	role, _ := r.Context().Value(middleware.RoleKey).(string)

	vars := mux.Vars(r)
	requestIDStr := vars["id"]
	requestID, err := strconv.Atoi(requestIDStr)
	if err != nil || requestID <= 0 {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request ID format")
		return
	}

	// Получаем детали заявки, чтобы проверить права и получить файл
	req, err := h.Repo.GetRequestDetailsByID(r.Context(), requestID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("DownloadRequestHandler: Error fetching details for request %d: %v", requestID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to fetch request details")
		return
	}

	// Проверка прав доступа
	hasAccess := false
	if role == string(models.RoleUser) && req.PartnerUserID == userID {
		hasAccess = true
	} else if role == string(models.RoleManager) {
		// Проверяем доступ менеджера
		managerHasAccess, checkErr := h.Repo.CheckManagerAccess(r.Context(), userID, requestID)
		if checkErr != nil {
			log.Printf("DownloadRequestHandler: Error checking manager access for manager %d, request %d: %v", userID, requestID, checkErr)
			handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to check access rights")
			return
		}
		hasAccess = managerHasAccess
	}

	if !hasAccess {
		handlers.RespondWithError(w, http.StatusForbidden, "You do not have permission to download this file")
		return
	}

	// Проверяем, есть ли файл
	if req.OverallTZFile == nil || len(req.OverallTZFile) == 0 {
		handlers.RespondWithError(w, http.StatusNotFound, "File not found for this request")
		return
	}

	// Определяем имя файла (можно сделать умнее, если хранить имя в БД)
	filename := fmt.Sprintf("tz_request_%d.file", requestID)
	// Пытаемся определить Content-Type (простая реализация)
	contentType := http.DetectContentType(req.OverallTZFile)

	w.Header().Set("Content-Disposition", "attachment; filename="+strconv.Quote(filename))
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", strconv.Itoa(len(req.OverallTZFile)))
	w.WriteHeader(http.StatusOK)
	_, err = w.Write(req.OverallTZFile)
	if err != nil {
		// Логируем ошибку, но статус уже отправлен
		log.Printf("DownloadRequestHandler: Error writing file for request %d: %v", requestID, err)
	}
}
