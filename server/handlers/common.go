package handlers

import (
	"encoding/json"
	"log"
	"net/http"
)

// ErrorResponse — структура для отправки ошибок в формате JSON
type ErrorResponse struct {
	Error string `json:"error"`
}

// RespondWithError — вспомогательная функция для отправки JSON-ошибок
func RespondWithError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(ErrorResponse{Error: message}); err != nil {
		log.Printf("Failed to encode error response: %v", err)
	}
}
