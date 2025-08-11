package requests

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/eeephemera/zvk-requests/server/db"
	"github.com/eeephemera/zvk-requests/server/handlers" // Предполагаем, что хелперы тут
	"github.com/eeephemera/zvk-requests/server/middleware"
	"github.com/eeephemera/zvk-requests/server/models"
	"github.com/eeephemera/zvk-requests/server/utils"
	"github.com/gorilla/mux"
	"github.com/shopspring/decimal"
)

// CreateRequestHandlerNew - Создание новой заявки по новой схеме.
// Ожидает multipart/form-data с полем 'request_data' (JSON) и 'overall_tz_file' (файл).
func (h *RequestHandler) CreateRequestHandlerNew(w http.ResponseWriter, r *http.Request) {
	// --- ДИАГНОСТИЧЕСКОЕ ЛОГИРОВАНИЕ ---
	log.Println("--- CreateRequestHandlerNew: Входящий запрос на создание заявки ---")
	log.Printf("Заголовок Content-Type: %s", r.Header.Get("Content-Type"))
	// --- КОНЕЦ ЛОГИРОВАНИЯ ---

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
	// Лимит тела и multipart: 15MB (соответствует UI)
	err = r.ParseMultipartForm(15 << 20)
	log.Printf("Результат ParseMultipartForm (nil - это хорошо): %v", err) // Логируем ошибку парсинга
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Failed to parse multipart form: "+err.Error())
		return
	}

	// --- ДИАГНОСТИЧЕСКОЕ ЛОГИРОВАНИЕ: ПРОВЕРКА КЛЮЧЕЙ ФОРМЫ ---
	if r.MultipartForm != nil {
		log.Println("Полученные ключи в multipart form (текстовые поля):")
		for key := range r.MultipartForm.Value {
			log.Printf("- %s", key)
		}
		log.Println("Полученные ключи в multipart form (файлы):")
		for key := range r.MultipartForm.File {
			log.Printf("- %s", key)
		}
	} else {
		log.Println("r.MultipartForm пуст (is nil)")
	}
	// --- КОНЕЦ ДИАГНОСТИЧЕСКОГО ЛОГИРОВАНИЯ ---

	// 4. Получаем JSON данные из поля 'request_data'
	requestDataJSON := r.FormValue("request_data")
	if requestDataJSON == "" {
		handlers.RespondWithError(w, http.StatusBadRequest, "Missing 'request_data' field in form")
		return
	}

	// 5. Десериализуем JSON в структуру DTO (или напрямую в Request, если поля совпадают)
	// Используем временную структуру DTO, чтобы отделить данные запроса от полной модели
	var requestDTO struct {
		EndClientINN             string `json:"end_client_inn"` // ИНН для поиска/создания клиента
		EndClientName            string `json:"end_client_name"`
		EndClientCity            string `json:"end_client_city"`
		EndClientFullAddress     string `json:"end_client_full_address"`
		EndClientContactDetails  string `json:"end_client_contact_details"`
		EndClientDetailsOverride string `json:"end_client_details_override"` // Если ИНН не указан
		DistributorID            *int   `json:"distributor_id"`
		PartnerContactOverride   string `json:"partner_contact_override"`
		FZLawType                string `json:"fz_law_type"`
		MPTRegistryType          string `json:"mpt_registry_type"`
		PartnerActivities        string `json:"partner_activities"`
		DealStateDescription     string `json:"deal_state_description"`
		EstimatedCloseDateStr    string `json:"estimated_close_date"` // Дата как строка YYYY-MM-DD
		// Новые поля для упрощенной модели
		ProjectName string  `json:"project_name"`
		Quantity    *int    `json:"quantity"`
		UnitPrice   *string `json:"unit_price"` // Принимаем как строку для гибкости
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

	// 8. Обрабатываем файлы (если есть)
	var fileIDs []int
	// Ключ 'overall_tz_files[]' должен соответствовать тому, как FormData на клиенте добавляет файлы
	uploadedFiles := r.MultipartForm.File["overall_tz_files[]"]
	if len(uploadedFiles) > 0 {
		log.Printf("Получено %d файлов для загрузки", len(uploadedFiles))
		for _, fileHeader := range uploadedFiles {
			// Лимит 15MB на файл
			if fileHeader.Size > 15*1024*1024 {
				handlers.RespondWithError(w, http.StatusRequestEntityTooLarge, "File exceeds 15MB limit")
				return
			}
			file, err := fileHeader.Open()
			if err != nil {
				log.Printf("CreateRequestHandlerNew: Error opening uploaded file %s: %v", fileHeader.Filename, err)
				handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to process uploaded file")
				return
			}
			defer file.Close()

			fileBytes, err := io.ReadAll(file)
			if err != nil {
				log.Printf("CreateRequestHandlerNew: Error reading uploaded file %s: %v", fileHeader.Filename, err)
				handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to read uploaded file")
				return
			}

			newFile := &models.File{
				FileName: utils.SanitizeFilename(fileHeader.Filename),
				MimeType: fileHeader.Header.Get("Content-Type"),
				FileSize: fileHeader.Size,
				FileData: fileBytes,
			}

			fileID, err := h.Repo.CreateFile(r.Context(), newFile)
			if err != nil {
				log.Printf("CreateRequestHandlerNew: Error saving file %s to DB: %v", fileHeader.Filename, err)
				handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to save file to database")
				return
			}
			fileIDs = append(fileIDs, fileID)
		}
	}

	// Обрабатываем и вычисляем цены
	var unitPriceDecimal *decimal.Decimal
	var totalPrice *decimal.Decimal
	if requestDTO.UnitPrice != nil && *requestDTO.UnitPrice != "" {
		parsedPrice, err := decimal.NewFromString(*requestDTO.UnitPrice)
		if err != nil {
			handlers.RespondWithError(w, http.StatusBadRequest, "Invalid format for unit_price")
			return
		}
		unitPriceDecimal = &parsedPrice
	}

	if requestDTO.Quantity != nil && unitPriceDecimal != nil {
		quantityDecimal := decimal.NewFromInt32(int32(*requestDTO.Quantity))
		calculatedTotal := quantityDecimal.Mul(*unitPriceDecimal)
		totalPrice = &calculatedTotal
	}

	// 9. Собираем основной объект заявки
	req := &models.Request{
		PartnerUserID:            userID,
		PartnerID:                *user.PartnerID,
		EndClientID:              endClientID,
		EndClientDetailsOverride: stringToPtr(requestDTO.EndClientDetailsOverride),
		DistributorID:            requestDTO.DistributorID,
		PartnerContactOverride:   stringToPtr(requestDTO.PartnerContactOverride),
		FZLawType:                stringToPtr(requestDTO.FZLawType),
		MPTRegistryType:          stringToPtr(requestDTO.MPTRegistryType),
		PartnerActivities:        stringToPtr(requestDTO.PartnerActivities),
		DealStateDescription:     stringToPtr(requestDTO.DealStateDescription),
		EstimatedCloseDate:       estimatedCloseDate,
		ProjectName:              stringToPtr(requestDTO.ProjectName),
		Quantity:                 requestDTO.Quantity,
		UnitPrice:                unitPriceDecimal,
		TotalPrice:               totalPrice,
		Status:                   models.StatusPending,
	}

	// 10. Создаем заявку в БД, передавая ID загруженных файлов
	if err := h.Repo.CreateRequest(r.Context(), req, fileIDs); err != nil {
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
	response := PaginatedResponse{
		Items: requests,
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
