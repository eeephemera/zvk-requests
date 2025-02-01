package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/eeephemera/zvk-requests/db"
	"github.com/eeephemera/zvk-requests/models"
	"github.com/gorilla/mux"
)

type RequestHandler struct {
	Repo *db.RequestRepository
}

// Создание запроса
func (h *RequestHandler) CreateRequestHandler(w http.ResponseWriter, r *http.Request) {
	var req models.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.Repo.CreateRequest(r.Context(), &req); err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(req)
}

// Получение запросов пользователя
func (h *RequestHandler) GetRequestsByUserHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(int)

	requests, err := h.Repo.GetRequestsByUser(r.Context(), userID)
	if err != nil {
		http.Error(w, "Failed to fetch requests", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(requests)
}

// Обновление запроса
func (h *RequestHandler) UpdateRequestHandler(w http.ResponseWriter, r *http.Request) {
	var req models.Request
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	req.UserID = r.Context().Value("userID").(int)

	if err := h.Repo.UpdateRequest(r.Context(), &req); err != nil {
		http.Error(w, "Failed to update request", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Request updated"))
}

// Удаление запроса
func (h *RequestHandler) DeleteRequestHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(int)
	requestID, _ := strconv.Atoi(mux.Vars(r)["id"])

	if err := h.Repo.DeleteRequest(r.Context(), requestID, userID); err != nil {
		http.Error(w, "Failed to delete request", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Request deleted"))
}
