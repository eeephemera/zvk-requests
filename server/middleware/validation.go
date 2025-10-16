// server/middleware/validation.go
package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

// ValidationError описывает ошибку валидации для одного поля
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidationResponse содержит список ошибок валидации
type ValidationResponse struct {
	Errors []ValidationError `json:"errors"`
}

// ValidateRequest проверяет входящий запрос по указанной схеме валидации
func ValidateRequest(validationFunc func(r *http.Request) []ValidationError) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Пропускаем GET и OPTIONS запросы
			if r.Method == http.MethodGet || r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			// Проверяем Content-Type
			contentType := r.Header.Get("Content-Type")
			if !strings.Contains(contentType, "application/json") &&
				!strings.Contains(contentType, "multipart/form-data") &&
				!strings.Contains(contentType, "application/x-www-form-urlencoded") {
				http.Error(w, "Unsupported Content-Type", http.StatusUnsupportedMediaType)
				return
			}

			// Выполняем валидацию
			errors := validationFunc(r)
			if len(errors) > 0 {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				_ = json.NewEncoder(w).Encode(ValidationResponse{Errors: errors})
				return
			}

			// Если ошибок нет, передаем управление следующему обработчику
			next.ServeHTTP(w, r)
		})
	}
}

// Пример функции валидации для создания заявки
func ValidateCreateRequest(r *http.Request) []ValidationError {
	var errors []ValidationError

	// Проверяем тип содержимого
	contentType := r.Header.Get("Content-Type")

	if strings.Contains(contentType, "multipart/form-data") {
		// Поддерживаем новую контрактную схему: FormData с полем 'request_data' (JSON)
		if err := r.ParseMultipartForm(20 << 20); err != nil {
			errors = append(errors, ValidationError{Field: "_form", Message: "Некорректный формат формы"})
			return errors
		}

		requestDataJSON := r.FormValue("request_data")
		if requestDataJSON == "" {
			errors = append(errors, ValidationError{Field: "request_data", Message: "Поле request_data обязательно"})
			return errors
		}

		// Проверяем, что request_data — корректный JSON
		var tmp map[string]any
		if err := json.Unmarshal([]byte(requestDataJSON), &tmp); err != nil {
			errors = append(errors, ValidationError{Field: "_json", Message: "Некорректный JSON в request_data"})
			return errors
		}

		// Файлы опциональны, но ограничим размер каждого до 15МБ
		if r.MultipartForm != nil {
			for field, fhs := range r.MultipartForm.File {
				for _, fh := range fhs {
					if fh.Size > 15*1024*1024 {
						errors = append(errors, ValidationError{Field: field, Message: "Размер файла не должен превышать 15МБ"})
					}
				}
			}
		}
	} else if strings.Contains(contentType, "application/json") {
		// Мягкая проверка JSON: просто валидируем, что тело — корректный JSON
		body, err := io.ReadAll(r.Body)
		if err != nil {
			errors = append(errors, ValidationError{Field: "_body", Message: "Не удалось прочитать тело запроса"})
			return errors
		}
		r.Body = io.NopCloser(strings.NewReader(string(body)))

		var tmp map[string]any
		if err := json.Unmarshal(body, &tmp); err != nil {
			errors = append(errors, ValidationError{Field: "_json", Message: "Некорректный JSON формат"})
			return errors
		}
	} else if strings.Contains(contentType, "application/x-www-form-urlencoded") {
		// Поддерживаем на всякий случай; строгих проверок нет
	} else {
		errors = append(errors, ValidationError{Field: "_content_type", Message: "Неподдерживаемый Content-Type"})
	}

	return errors
}
