package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/eeephemera/zvk-requests/db"
	"github.com/eeephemera/zvk-requests/models"
)

// CreateRequest создаёт новый запрос в базе данных.
func CreateRequest(w http.ResponseWriter, r *http.Request) {
	var request models.Request

	// Прочитать данные из тела запроса
	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		http.Error(w, "Unable to parse request", http.StatusBadRequest)
		return
	}

	// Вставить новый запрос в базу данных
	query := "INSERT INTO requests (customer, product, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) RETURNING id"
	err = db.GetDBConnection().QueryRow(context.Background(), query, request.Customer, request.Product, request.Status, time.Now(), time.Now()).Scan(&request.ID)
	if err != nil {
		http.Error(w, "Unable to create request", http.StatusInternalServerError)
		return
	}

	// Ответ клиенту с созданным запросом
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(request)
}
