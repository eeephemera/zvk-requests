// server/middleware/validation.go
package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/eeephemera/zvk-requests/server/validation"
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

	// В зависимости от Content-Type извлекаем данные
	contentType := r.Header.Get("Content-Type")

	if strings.Contains(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(10 << 20); err != nil {
			errors = append(errors, ValidationError{Field: "_form", Message: "Некорректный формат формы"})
			return errors
		}

		// Валидация полей формы
		if err := validation.ValidateINN(r.FormValue("inn")); err != nil {
			errors = append(errors, ValidationError{Field: "inn", Message: err.Error()})
		}

		if err := validation.ValidateOrgName(r.FormValue("organization_name")); err != nil {
			errors = append(errors, ValidationError{Field: "organization_name", Message: err.Error()})
		}

		if err := validation.ValidateImplementationDate(r.FormValue("implementation_date")); err != nil {
			errors = append(errors, ValidationError{Field: "implementation_date", Message: err.Error()})
		}

		if err := validation.ValidateFZType(r.FormValue("fz_type")); err != nil {
			errors = append(errors, ValidationError{Field: "fz_type", Message: err.Error()})
		}

		if err := validation.ValidateRegistryType(r.FormValue("registry_type")); err != nil {
			errors = append(errors, ValidationError{Field: "registry_type", Message: err.Error()})
		}

		// Проверка наличия файла
		_, fileHeader, err := r.FormFile("tz_file")
		if err != nil {
			errors = append(errors, ValidationError{Field: "tz_file", Message: "Файл ТЗ обязателен"})
		} else if fileHeader.Size > 10*1024*1024 {
			errors = append(errors, ValidationError{Field: "tz_file", Message: "Размер файла не должен превышать 10МБ"})
		}
	} else if strings.Contains(contentType, "application/json") {
		// Для JSON запросов
		body, err := io.ReadAll(r.Body)
		if err != nil {
			errors = append(errors, ValidationError{Field: "_body", Message: "Не удалось прочитать тело запроса"})
			return errors
		}
		r.Body = io.NopCloser(strings.NewReader(string(body)))

		var requestData struct {
			Inn                string `json:"inn"`
			OrganizationName   string `json:"organization_name"`
			ImplementationDate string `json:"implementation_date"`
			FZType             string `json:"fz_type"`
			RegistryType       string `json:"registry_type"`
		}

		if err := json.Unmarshal(body, &requestData); err != nil {
			errors = append(errors, ValidationError{Field: "_json", Message: "Некорректный JSON формат"})
			return errors
		}

		// Валидация полей
		if err := validation.ValidateINN(requestData.Inn); err != nil {
			errors = append(errors, ValidationError{Field: "inn", Message: err.Error()})
		}

		if err := validation.ValidateOrgName(requestData.OrganizationName); err != nil {
			errors = append(errors, ValidationError{Field: "organization_name", Message: err.Error()})
		}

		if err := validation.ValidateImplementationDate(requestData.ImplementationDate); err != nil {
			errors = append(errors, ValidationError{Field: "implementation_date", Message: err.Error()})
		}

		if err := validation.ValidateFZType(requestData.FZType); err != nil {
			errors = append(errors, ValidationError{Field: "fz_type", Message: err.Error()})
		}

		if err := validation.ValidateRegistryType(requestData.RegistryType); err != nil {
			errors = append(errors, ValidationError{Field: "registry_type", Message: err.Error()})
		}
	} else {
		errors = append(errors, ValidationError{Field: "_content_type", Message: "Неподдерживаемый Content-Type"})
	}

	return errors
}
