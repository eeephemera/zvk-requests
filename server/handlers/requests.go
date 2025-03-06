package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/eeephemera/zvk-requests/db"
	"github.com/eeephemera/zvk-requests/middleware"
	"github.com/eeephemera/zvk-requests/models"
	"github.com/gorilla/mux"
)

// RequestHandler содержит ссылку на репозиторий заявок
type RequestHandler struct {
	Repo *db.RequestRepository
}

// ErrorResponse — структура для отправки ошибок в формате JSON
type ErrorResponse struct {
	Error string `json:"error"`
}

// CreateRequestHandler — обработчик для создания новой заявки
func (h *RequestHandler) CreateRequestHandler(w http.ResponseWriter, r *http.Request) {
	var req models.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Проверка обязательных полей. Если "product_name" не требуется, уберите это условие.
	if req.Description == "" {
		respondWithError(w, http.StatusBadRequest, "Description is required")
		return
	}

	// Извлекаем userID из контекста, который проставляет middleware.ValidateToken
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	req.UserID = userID

	// При желании установить статус по умолчанию
	if req.Status == "" {
		req.Status = "На рассмотрении"
	}

	// Вызов метода репозитория для создания заявки в БД
	if err := h.Repo.CreateRequest(r.Context(), &req); err != nil {
		log.Printf("Create request error: %v", err)
		if strings.Contains(err.Error(), "unique constraint") {
			// Если у вас есть уникальный индекс на какие-то поля, можно вернуть 409 Conflict
			respondWithError(w, http.StatusConflict, "Request already exists")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to create request")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req)
}

// GetRequestsByUserHandler — обработчик для получения списка заявок пользователя
func (h *RequestHandler) GetRequestsByUserHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Параметры пагинации
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 10
	}

	// Получаем заявки из репозитория
	requests, err := h.Repo.GetRequestsByUser(r.Context(), userID, limit, offset)
	if err != nil {
		log.Printf("Get requests error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch requests")
		return
	}

	// Всегда возвращаем JSON, даже если заявок нет
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)        // Всегда 200 OK
	json.NewEncoder(w).Encode(requests) // Вернётся [] если requests пустой
}

// UpdateRequestHandler — обработчик для обновления заявки
func (h *RequestHandler) UpdateRequestHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	var req models.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Проверяем, что заявка существует и принадлежит текущему пользователю
	existingReq, err := h.Repo.GetRequestByID(r.Context(), req.ID, userID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			respondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("Update request error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	// Сохраняем неизменяемые поля, если нужно
	req.UserID = existingReq.UserID       // или userID, если то же самое
	req.CreatedAt = existingReq.CreatedAt // чтобы не сбрасывать дату создания

	// Обновляем данные заявки в БД
	if err := h.Repo.UpdateRequest(r.Context(), &req); err != nil {
		log.Printf("Update request error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(req)
}

// DeleteRequestHandler — обработчик для удаления заявки
func (h *RequestHandler) DeleteRequestHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	vars := mux.Vars(r)
	requestID, err := strconv.Atoi(vars["id"])
	if err != nil || requestID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	// Удаляем заявку в репозитории
	if err := h.Repo.DeleteRequest(r.Context(), requestID, userID); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			respondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("Delete request error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete request")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// respondWithError — вспомогательная функция для отправки JSON-ошибок
func respondWithError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(ErrorResponse{Error: message})
}
