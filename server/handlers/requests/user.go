package requests

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/eeephemera/zvk-requests/db"
	"github.com/eeephemera/zvk-requests/handlers"
	"github.com/eeephemera/zvk-requests/middleware"
	"github.com/eeephemera/zvk-requests/models"
	"github.com/gorilla/mux"
)

// CreateRequestHandler — создание новой заявки (для пользователя)
func (h *RequestHandler) CreateRequestHandler(w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}

	inn := r.FormValue("inn")
	organizationName := r.FormValue("organization_name")
	implementationDateStr := r.FormValue("implementation_date")
	fzType := r.FormValue("fz_type")
	comment := r.FormValue("comment")
	registryType := r.FormValue("registry_type")

	implementationDate, err := time.Parse("2006-01-02", implementationDateStr)
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid implementation date")
		return
	}

	file, _, err := r.FormFile("tz_file")
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Failed to get file")
		return
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to read file")
		return
	}

	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

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

	if err := h.Repo.CreateRequest(r.Context(), req); err != nil {
		log.Printf("Create request error: %v", err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to create request")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req)
}

// GetRequestsByUserHandler — список заявок текущего пользователя
func (h *RequestHandler) GetRequestsByUserHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 || limit > 100 {
		limit = 10
	}

	requests, err := h.Repo.GetRequestsByUser(r.Context(), userID, limit, offset)
	if err != nil {
		log.Printf("Get requests error: %v", err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to fetch requests")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(requests)
}

// UpdateRequestHandler — обновление заявки пользователем
func (h *RequestHandler) UpdateRequestHandler(w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	inn := r.FormValue("inn")
	organizationName := r.FormValue("organization_name")
	implementationDateStr := r.FormValue("implementation_date")
	fzType := r.FormValue("fz_type")
	comment := r.FormValue("comment")
	registryType := r.FormValue("registry_type")

	implementationDate, err := time.Parse("2006-01-02", implementationDateStr)
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid implementation date")
		return
	}

	var tzFile []byte
	file, _, err := r.FormFile("tz_file")
	if err == nil {
		defer file.Close()
		tzFile, err = io.ReadAll(file)
		if err != nil {
			handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to read file")
			return
		}
	} else if !errors.Is(err, http.ErrMissingFile) {
		handlers.RespondWithError(w, http.StatusBadRequest, "Failed to get file")
		return
	}

	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	existingReq, err := h.Repo.GetRequestByID(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("Update request error: %v", err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	if tzFile == nil {
		tzFile = existingReq.TZFile
	}

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

	if err := h.Repo.UpdateRequest(r.Context(), updatedReq); err != nil {
		log.Printf("Update request error: %v", err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(updatedReq)
}

// DeleteRequestHandler — удаление заявки пользователем
func (h *RequestHandler) DeleteRequestHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	vars := mux.Vars(r)
	requestID, err := strconv.Atoi(vars["id"])
	if err != nil || requestID <= 0 {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	if err := h.Repo.DeleteRequest(r.Context(), requestID, userID); err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("Delete request error: %v", err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to delete request")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
