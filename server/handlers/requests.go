package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

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
	err := r.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}

	// Extract fields
	inn := r.FormValue("inn")
	organizationName := r.FormValue("organization_name")
	implementationDateStr := r.FormValue("implementation_date")
	fzType := r.FormValue("fz_type")
	comment := r.FormValue("comment")
	registryType := r.FormValue("registry_type")

	// Parse date
	implementationDate, err := time.Parse("2006-01-02", implementationDateStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid implementation date")
		return
	}

	// Get file
	file, _, err := r.FormFile("tz_file")
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Failed to get file")
		return
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to read file")
		return
	}

	// Get userID from context
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Create request object
	req := &models.Request{
		UserID:             userID,
		INN:                inn,
		OrganizationName:   organizationName,
		ImplementationDate: implementationDate,
		FZType:             fzType,
		RegistryType:       registryType,
		Comment:            comment,
		TZFile:             fileBytes,
		Status:             "На рассмотрении",
	}

	// Save to database
	if err := h.Repo.CreateRequest(r.Context(), req); err != nil {
		log.Printf("Create request error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create request")
		return
	}

	// Respond with success
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
	// Parse multipart form
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}

	// Extract fields
	idStr := r.FormValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	inn := r.FormValue("inn")
	organizationName := r.FormValue("organization_name")
	implementationDateStr := r.FormValue("implementation_date")
	fzType := r.FormValue("fz_type")
	comment := r.FormValue("comment")
	registryType := r.FormValue("registry_type")

	// Parse date
	implementationDate, err := time.Parse("2006-01-02", implementationDateStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid implementation date")
		return
	}

	// Get file if provided
	var tzFile []byte
	file, _, err := r.FormFile("tz_file")
	if err == nil {
		defer file.Close()
		tzFile, err = io.ReadAll(file)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to read file")
			return
		}
	} else if !errors.Is(err, http.ErrMissingFile) {
		respondWithError(w, http.StatusBadRequest, "Failed to get file")
		return
	}

	// Get userID from context
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Get existing request to check ownership and get current TZFile if no new file
	existingReq, err := h.Repo.GetRequestByID(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			respondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("Update request error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	// If no new file, use existing TZFile
	if tzFile == nil {
		tzFile = existingReq.TZFile
	}

	// Create updated request object
	updatedReq := &models.Request{
		ID:                 id,
		UserID:             userID,
		INN:                inn,
		OrganizationName:   organizationName,
		ImplementationDate: implementationDate,
		FZType:             fzType,
		RegistryType:       registryType,
		Comment:            comment,
		TZFile:             tzFile,
		Status:             existingReq.Status,
	}

	// Update in database
	if err := h.Repo.UpdateRequest(r.Context(), updatedReq); err != nil {
		log.Printf("Update request error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(updatedReq)
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

// UpdateRequestByManagerHandler — обработчик для обновления заявки менеджером
func (h *RequestHandler) UpdateRequestByManagerHandler(w http.ResponseWriter, r *http.Request) {
	// Parse multipart form
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}

	// Extract fields
	idStr := r.FormValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	inn := r.FormValue("inn")
	organizationName := r.FormValue("organization_name")
	implementationDateStr := r.FormValue("implementation_date")
	fzType := r.FormValue("fz_type")
	comment := r.FormValue("comment")
	registryType := r.FormValue("registry_type")
	status := r.FormValue("status")

	// Parse date
	implementationDate, err := time.Parse("2006-01-02", implementationDateStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid implementation date")
		return
	}

	// Get file if provided
	var tzFile []byte
	file, _, err := r.FormFile("tz_file")
	if err == nil {
		defer file.Close()
		tzFile, err = io.ReadAll(file)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to read file")
			return
		}
	} else if !errors.Is(err, http.ErrMissingFile) {
		respondWithError(w, http.StatusBadRequest, "Failed to get file")
		return
	}

	// Get existing request to get current TZFile if no new file
	existingReq, err := h.Repo.GetRequestByIDWithoutUser(r.Context(), id)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			respondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("Manager update request error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	// If no new file, use existing TZFile
	if tzFile == nil {
		tzFile = existingReq.TZFile
	}

	// Create updated request object
	updatedReq := &models.Request{
		ID:                 id,
		UserID:             existingReq.UserID,
		INN:                inn,
		OrganizationName:   organizationName,
		ImplementationDate: implementationDate,
		FZType:             fzType,
		RegistryType:       registryType,
		Comment:            comment,
		TZFile:             tzFile,
		Status:             status,
	}

	// Update in database
	if err := h.Repo.UpdateRequestWithoutUser(r.Context(), updatedReq); err != nil {
		log.Printf("Manager update request error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(updatedReq)
}

// DeleteRequestByManagerHandler — обработчик для удаления заявки менеджером
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
