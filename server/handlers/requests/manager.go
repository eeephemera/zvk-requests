package requests

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/eeephemera/zvk-requests/db"
	"github.com/eeephemera/zvk-requests/handlers"
	"github.com/eeephemera/zvk-requests/models"
	"github.com/gorilla/mux"
)

// UpdateRequestByManagerHandler — обновление заявки менеджером
func (h *RequestHandler) UpdateRequestByManagerHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	// Проверяем существующую заявку
	existingReq, err := h.Repo.GetRequestByIDWithoutUser(r.Context(), id)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("Manager update request error: %v", err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to fetch request")
		return
	}

	// Логируем запрос для отладки
	contentType := r.Header.Get("Content-Type")
	log.Printf("Received request: Method=%s, Content-Type=%s, Headers=%v", r.Method, contentType, r.Header)
	body, _ := io.ReadAll(r.Body)
	log.Printf("Request body: %s", string(body))
	r.Body = io.NopCloser(strings.NewReader(string(body))) // Восстанавливаем тело

	var updatedReq *models.Request

	if strings.Contains(strings.ToLower(contentType), "application/json") {
		log.Printf("Processing as JSON")
		var updateData struct {
			Status string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
			log.Printf("Failed to decode JSON: %v", err)
			handlers.RespondWithError(w, http.StatusBadRequest, "Invalid JSON payload")
			return
		}

		if updateData.Status == "" {
			handlers.RespondWithError(w, http.StatusBadRequest, "Status is required")
			return
		}

		updatedReq = &models.Request{
			ID:                 id,
			UserID:             existingReq.UserID,
			INN:                existingReq.INN,
			OrganizationName:   existingReq.OrganizationName,
			ImplementationDate: existingReq.ImplementationDate,
			FZType:             existingReq.FZType,
			RegistryType:       existingReq.RegistryType,
			Comment:            existingReq.Comment,
			TZFile:             existingReq.TZFile,
			Status:             updateData.Status,
		}
	} else if strings.Contains(strings.ToLower(contentType), "multipart/form-data") {
		log.Printf("Processing as multipart/form-data")
		err = r.ParseMultipartForm(10 << 20)
		if err != nil {
			log.Printf("Failed to parse multipart form: %v", err)
			handlers.RespondWithError(w, http.StatusBadRequest, "Failed to parse form")
			return
		}

		inn := r.FormValue("inn")
		organizationName := r.FormValue("organization_name")
		implementationDateStr := r.FormValue("implementation_date")
		fzType := r.FormValue("fz_type")
		comment := r.FormValue("comment")
		registryType := r.FormValue("registry_type")
		status := r.FormValue("status")

		var implementationDate time.Time
		if implementationDateStr != "" {
			implementationDate, err = time.Parse("2006-01-02", implementationDateStr)
			if err != nil {
				handlers.RespondWithError(w, http.StatusBadRequest, "Invalid implementation date")
				return
			}
		} else {
			implementationDate = existingReq.ImplementationDate
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
		if tzFile == nil {
			tzFile = existingReq.TZFile
		}

		updatedReq = &models.Request{
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
	} else {
		log.Printf("Unsupported Content-Type: %s", contentType)
		handlers.RespondWithError(w, http.StatusUnsupportedMediaType, "Unsupported Content-Type: "+contentType)
		return
	}

	// Сохраняем изменения
	if err := h.Repo.UpdateRequestWithoutUser(r.Context(), updatedReq); err != nil {
		log.Printf("Manager update request error: %v", err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	log.Printf("Request updated successfully: ID=%d, Status=%s", id, updatedReq.Status)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(updatedReq)
}

func (h *RequestHandler) GetAllRequestsHandler(w http.ResponseWriter, r *http.Request) {
	requests, err := h.Repo.GetAllRequests(r.Context(), 100, 0) // Лимит и офсет можно настроить
	if err != nil {
		log.Printf("Get all requests error: %v", err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to fetch requests")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(requests)
}

func (h *RequestHandler) DeleteRequestByManagerHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	// Сначала проверяем, существует ли заявка
	_, err = h.Repo.GetRequestByIDWithoutUser(r.Context(), id)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			log.Printf("Request not found for deletion: ID=%d", id)
			handlers.RespondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("Error checking request existence for ID=%d: %v", id, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to check request existence")
		return
	}

	// Теперь пытаемся удалить
	if err := h.Repo.DeleteRequestWithoutUser(r.Context(), id); err != nil {
		// Проверяем дополнительно на случай, если запись была удалена между проверкой и удалением
		if errors.Is(err, db.ErrNotFound) || strings.Contains(strings.ToLower(err.Error()), "not found") {
			log.Printf("Request not found during deletion: ID=%d", id)
			handlers.RespondWithError(w, http.StatusNotFound, "Request not found")
			return
		}

		// Логируем детальную информацию об ошибке
		log.Printf("Delete request error for ID=%d: %v", id, err)

		// Проверяем на нарушение ограничения внешнего ключа
		if strings.Contains(err.Error(), "foreign key constraint") {
			handlers.RespondWithError(w, http.StatusConflict, "Cannot delete request: it is referenced by other records")
			return
		}

		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to delete request")
		return
	}

	log.Printf("Request successfully deleted: ID=%d", id)
	w.WriteHeader(http.StatusNoContent)
}

func (h *RequestHandler) DownloadTZFileHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	req, err := h.Repo.GetRequestByIDWithoutUser(r.Context(), id)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("Fetch request error: %v", err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to fetch request")
		return
	}

	if req.TZFile == nil {
		handlers.RespondWithError(w, http.StatusNotFound, "TZ file not found")
		return
	}

	// Определяем тип файла по его содержимому
	fileType := http.DetectContentType(req.TZFile)

	// Устанавливаем имя файла с расширением в зависимости от типа
	filename := fmt.Sprintf("tz_file_%d", id)

	// Добавляем расширение в зависимости от типа файла
	switch fileType {
	case "application/pdf":
		filename += ".pdf"
	case "image/jpeg":
		filename += ".jpg"
	case "image/png":
		filename += ".png"
	case "application/msword":
		filename += ".doc"
	case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		filename += ".docx"
	case "application/vnd.ms-excel":
		filename += ".xls"
	case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		filename += ".xlsx"
	default:
		filename += ".bin" // Бинарный файл по умолчанию
	}

	// Устанавливаем заголовки для скачивания
	w.Header().Set("Content-Type", fileType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(req.TZFile)))

	// Логируем информацию о скачивании
	log.Printf("Downloading file for request ID=%d, type=%s, filename=%s", id, fileType, filename)

	// Отправляем файл
	w.Write(req.TZFile)
}

func (h *RequestHandler) GetRequestByIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	req, err := h.Repo.GetRequestByIDWithoutUser(r.Context(), id)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("Fetch request error: %v", err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to fetch request")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(req)
}
