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
	"github.com/eeephemera/zvk-requests/handlers" // Предполагаем, что хелперы тут
	"github.com/eeephemera/zvk-requests/middleware"
	"github.com/eeephemera/zvk-requests/models"
	"github.com/gorilla/mux"
)

// CreateRequestHandlerNew - Создание новой заявки по новой схеме.
// Ожидает multipart/form-data с полем 'request_data' (JSON) и 'overall_tz_file' (файл).
func (h *RequestHandler) CreateRequestHandlerNew(w http.ResponseWriter, r *http.Request) {
	// 1. Получаем ID пользователя из контекста
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// 2. Получаем детали пользователя, включая partner_id
	user, err := h.UserRepo.GetUserByID(r.Context(), userID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusUnauthorized, "Authenticated user not found in database")
			return
		}
		log.Printf("CreateRequestHandlerNew: Error fetching user %d: %v", userID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to retrieve user details")
		return
	}
	if user.PartnerID == nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "User is not associated with a partner organization")
		return
	}

	// 3. Парсим multipart form
	// Увеличиваем лимит, если файлы могут быть большими (например, 32MB)
	err = r.ParseMultipartForm(32 << 20)
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Failed to parse multipart form: "+err.Error())
		return
	}

	// 4. Получаем JSON данные из поля 'request_data'
	requestDataJSON := r.FormValue("request_data")
	if requestDataJSON == "" {
		handlers.RespondWithError(w, http.StatusBadRequest, "Missing 'request_data' field in form")
		return
	}

	// 5. Десериализуем JSON в структуру DTO (или напрямую в Request, если поля совпадают)
	// Используем временную структуру DTO, чтобы отделить данные запроса от полной модели
	var requestDTO struct {
		EndClientINN             string               `json:"end_client_inn"` // ИНН для поиска/создания клиента
		EndClientName            string               `json:"end_client_name"`
		EndClientCity            string               `json:"end_client_city"`
		EndClientFullAddress     string               `json:"end_client_full_address"`
		EndClientContactDetails  string               `json:"end_client_contact_details"`
		EndClientDetailsOverride string               `json:"end_client_details_override"` // Если ИНН не указан
		DistributorID            *int                 `json:"distributor_id"`
		PartnerContactOverride   string               `json:"partner_contact_override"`
		FZLawType                string               `json:"fz_law_type"`
		MPTRegistryType          string               `json:"mpt_registry_type"`
		PartnerActivities        string               `json:"partner_activities"`
		DealStateDescription     string               `json:"deal_state_description"`
		EstimatedCloseDateStr    string               `json:"estimated_close_date"` // Дата как строка YYYY-MM-DD
		Items                    []models.RequestItem `json:"items"`
		Status                   string               `json:"status"` // Позволяем установить начальный статус? Или всегда default?
	}

	if err := json.Unmarshal([]byte(requestDataJSON), &requestDTO); err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid JSON in 'request_data': "+err.Error())
		return
	}

	// 6. Обрабатываем конечного клиента
	var endClientID *int
	if requestDTO.EndClientINN != "" {
		// Пытаемся найти клиента по ИНН
		foundClient, err := h.EndClientRepo.FindEndClientByINN(r.Context(), requestDTO.EndClientINN)
		if err != nil {
			log.Printf("CreateRequestHandlerNew: Error finding end client by INN %s: %v", requestDTO.EndClientINN, err)
			handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to check end client existence")
			return
		}
		if foundClient != nil {
			endClientID = &foundClient.ID
		} else {
			// Если не найден, создаем нового
			newClient := &models.EndClient{
				Name:                 requestDTO.EndClientName, // Нужно передавать все поля
				City:                 stringToPtr(requestDTO.EndClientCity),
				INN:                  stringToPtr(requestDTO.EndClientINN),
				FullAddress:          stringToPtr(requestDTO.EndClientFullAddress),
				ContactPersonDetails: stringToPtr(requestDTO.EndClientContactDetails),
			}
			if err := h.EndClientRepo.CreateEndClient(r.Context(), newClient); err != nil {
				log.Printf("CreateRequestHandlerNew: Error creating new end client with INN %s: %v", requestDTO.EndClientINN, err)
				handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to create new end client")
				return
			}
			endClientID = &newClient.ID
		}
	}

	// 7. Обрабатываем дату
	var estimatedCloseDate *time.Time
	if requestDTO.EstimatedCloseDateStr != "" {
		parsedDate, err := time.Parse("2006-01-02", requestDTO.EstimatedCloseDateStr)
		if err != nil {
			handlers.RespondWithError(w, http.StatusBadRequest, "Invalid format for estimated_close_date (use YYYY-MM-DD)")
			return
		}
		estimatedCloseDate = &parsedDate
	}

	// 8. Обрабатываем файл (если есть)
	var fileBytes []byte
	file, _, err := r.FormFile("overall_tz_file")
	if err == nil { // Файл был прислан
		defer file.Close()
		fileBytes, err = io.ReadAll(file)
		if err != nil {
			log.Printf("CreateRequestHandlerNew: Error reading uploaded file for user %d: %v", userID, err)
			handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to read uploaded file")
			return
		}
	} else if !errors.Is(err, http.ErrMissingFile) {
		// Была другая ошибка при попытке получить файл
		handlers.RespondWithError(w, http.StatusBadRequest, "Error processing uploaded file: "+err.Error())
		return
	} // Если http.ErrMissingFile - просто пропускаем, файл не обязателен

	// 9. Собираем основной объект заявки
	req := &models.Request{
		PartnerUserID:            userID,
		PartnerID:                *user.PartnerID,                                  // Мы проверили, что PartnerID не nil
		EndClientID:              endClientID,                                      // Может быть nil
		EndClientDetailsOverride: stringToPtr(requestDTO.EndClientDetailsOverride), // Используется, если EndClientID is nil или для доп. информации
		DistributorID:            requestDTO.DistributorID,
		PartnerContactOverride:   stringToPtr(requestDTO.PartnerContactOverride),
		FZLawType:                stringToPtr(requestDTO.FZLawType),
		MPTRegistryType:          stringToPtr(requestDTO.MPTRegistryType),
		PartnerActivities:        stringToPtr(requestDTO.PartnerActivities),
		DealStateDescription:     stringToPtr(requestDTO.DealStateDescription),
		EstimatedCloseDate:       estimatedCloseDate,
		OverallTZFile:            fileBytes,
		Items:                    requestDTO.Items,
		// Status: requestDTO.Status, // Обычно статус устанавливается по умолчанию или логикой бэкенда
		Status: "На рассмотрении", // Устанавливаем по умолчанию здесь
	}

	// Валидация Items (например, проверка Quantity > 0) может быть добавлена здесь

	// 10. Создаем заявку в БД
	if err := h.Repo.CreateRequest(r.Context(), req); err != nil {
		log.Printf("CreateRequestHandlerNew: Error calling repository CreateRequest for user %d: %v", userID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to save request")
		return
	}

	// 11. Отправляем успешный ответ
	// Возвращаем созданную заявку с ID и временными метками
	handlers.RespondWithJSON(w, http.StatusCreated, req)
}

// PaginatedResponse - структура для пагинированных ответов
type PaginatedResponse struct {
	Items interface{} `json:"items"` // Используем interface{} для универсальности
	Total int64       `json:"total"`
	Page  int         `json:"page"`
	Limit int         `json:"limit"`
}

// ListMyRequestsHandler — список заявок текущего пользователя (пагинированный)
func (h *RequestHandler) ListMyRequestsHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Получаем параметры пагинации из запроса
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		page = 1 // Страница по умолчанию
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 { // Ограничиваем лимит
		limit = 10 // Лимит по умолчанию
	}
	offset := (page - 1) * limit

	// Вызываем обновленный метод репозитория
	requests, total, err := h.Repo.ListRequestsByUser(r.Context(), userID, limit, offset)
	if err != nil {
		log.Printf("ListMyRequestsHandler: Error fetching requests for user %d: %v", userID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to fetch requests")
		return
	}

	// Создаем структуру для ответа
	response := models.PaginatedResponse{
		Items: requests, // Метод ListRequestsByUser уже возвращает нужные поля для списка
		Total: total,
		Page:  page,
		Limit: limit,
	}

	handlers.RespondWithJSON(w, http.StatusOK, response)
}

// GetMyRequestDetailsHandler - Получение деталей конкретной заявки пользователя
func (h *RequestHandler) GetMyRequestDetailsHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Получаем ID пользователя из контекста
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// 2. Получаем ID заявки из URL
	vars := mux.Vars(r)
	requestIDStr := vars["id"]
	requestID, err := strconv.Atoi(requestIDStr)
	if err != nil || requestID <= 0 {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request ID format")
		return
	}

	// 3. Получаем детали заявки из репозитория
	req, err := h.Repo.GetRequestDetailsByID(r.Context(), requestID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusNotFound, "Request not found")
			return
		}
		log.Printf("GetMyRequestDetailsHandler: Error fetching details for request %d: %v", requestID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to fetch request details")
		return
	}

	// 4. Проверяем права доступа: пользователь должен быть создателем заявки
	if req.PartnerUserID != userID {
		handlers.RespondWithError(w, http.StatusForbidden, "You do not have permission to view this request")
		return
	}

	// 5. Отправляем ответ
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(req)
}

// DeleteMyRequestHandler - Удаление конкретной заявки пользователя
func (h *RequestHandler) DeleteMyRequestHandler(w http.ResponseWriter, r *http.Request) {
	// ... (реализация аналогична GetMyRequestDetailsHandler, но с вызовом DeleteRequest)
}

// stringToPtr возвращает указатель на строку или nil, если строка пустая.
func stringToPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
