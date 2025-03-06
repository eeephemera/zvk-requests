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

// respondWithError — вспомогательная функция для отправки JSON-ошибок
func respondWithError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(ErrorResponse{Error: message})
}

// ==========================
// Обработчики для пользователей
// ==========================

// CreateRequestHandler — обработчик для создания новой заявки (для пользователя)
func (h *RequestHandler) CreateRequestHandler(w http.ResponseWriter, r *http.Request) {
	var req models.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Проверка обязательных полей (например, Description)
	if req.Description == "" {
		respondWithError(w, http.StatusBadRequest, "Description is required")
		return
	}

	// Извлекаем userID из контекста (проставляется middleware.ValidateToken)
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	req.UserID = userID

	// Устанавливаем статус по умолчанию, если не задан
	if req.Status == "" {
		req.Status = "На рассмотрении"
	}

	// Создаем заявку в БД через репозиторий
	if err := h.Repo.CreateRequest(r.Context(), &req); err != nil {
		log.Printf("Create request error: %v", err)
		if strings.Contains(err.Error(), "unique constraint") {
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

// GetRequestsByUserHandler — обработчик для получения списка заявок текущего пользователя
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

	requests, err := h.Repo.GetRequestsByUser(r.Context(), userID, limit, offset)
	if err != nil {
		log.Printf("Get requests error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch requests")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(requests)
}

// UpdateRequestHandler — обработчик для обновления заявки пользователем
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

	// Сохраняем неизменяемые поля
	req.UserID = existingReq.UserID
	req.CreatedAt = existingReq.CreatedAt

	if err := h.Repo.UpdateRequest(r.Context(), &req); err != nil {
		log.Printf("Update request error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(req)
}

// DeleteRequestHandler — обработчик для удаления заявки пользователем
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

// ==========================
// Обработчики для менеджеров
// ==========================

// GetAllRequestsHandler — обработчик для получения всех заявок (для менеджера)
func (h *RequestHandler) GetAllRequestsHandler(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 10
	}

	requests, err := h.Repo.GetAllRequests(r.Context(), limit, offset)
	if err != nil {
		log.Printf("Get all requests error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch all requests")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(requests)
}

// UpdateRequestByManagerHandler — обработчик для обновления заявки менеджером (без проверки владельца)
func (h *RequestHandler) UpdateRequestByManagerHandler(w http.ResponseWriter, r *http.Request) {
	var req models.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Получаем заявку без фильтра по userID
	existingReq, err := h.Repo.GetRequestByIDWithoutUser(r.Context(), req.ID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			respondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("Manager update request error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	// Сохраняем неизменяемые поля
	req.UserID = existingReq.UserID
	req.CreatedAt = existingReq.CreatedAt

	// Используем метод UpdateRequestWithoutUser для обновления заявки менеджером
	if err := h.Repo.UpdateRequestWithoutUser(r.Context(), &req); err != nil {
		log.Printf("Manager update request error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(req)
}

// DeleteRequestByManagerHandler — обработчик для удаления заявки менеджером (без проверки владельца)
func (h *RequestHandler) DeleteRequestByManagerHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	requestID, err := strconv.Atoi(vars["id"])
	if err != nil || requestID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	if err := h.Repo.DeleteRequestWithoutUser(r.Context(), requestID); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			respondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("Manager delete request error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete request")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
