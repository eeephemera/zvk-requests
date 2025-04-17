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
	RespondWithJSON(w, code, ErrorResponse{Error: message})
}

// RespondWithJSON отправляет JSON-ответ с указанным кодом статуса
func RespondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Error marshaling JSON response: %v", err)
		// Отправляем базовый текст ошибки, так как маршалинг самого JSON не удался
		http.Error(w, `{"error":"Failed to marshal JSON response"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, err = w.Write(response)
	if err != nil {
		// Логируем ошибку записи ответа, но ничего больше сделать не можем
		log.Printf("Error writing JSON response: %v", err)
	}
}
