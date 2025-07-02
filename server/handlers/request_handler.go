package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/shopspring/decimal"

	"github.com/eeephemera/zvk-requests/server/models"
)

// Определим интерфейс репозитория, чтобы хендлер не зависел от конкретной реализации
type RequestRepository interface {
	CreateRequest(ctx context.Context, req *models.Request, fileIDs []int) error
	CreateFile(ctx context.Context, file *models.File) (int, error)
	FindEndClientByINN(ctx context.Context, inn string) (*models.EndClient, error)
	CreateEndClient(ctx context.Context, client *models.EndClient) (int, error)
	// Добавьте другие методы, которые использует хендлер
}

// RequestHandler содержит зависимости для обработчиков запросов.
type RequestHandler struct {
	repo      RequestRepository
	validator *validator.Validate
}

// NewRequestHandler создает новый экземпляр RequestHandler.
func NewRequestHandler(repo RequestRepository) *RequestHandler {
	return &RequestHandler{
		repo:      repo,
		validator: validator.New(),
	}
}

// CreateRequestDTO defines the structure of data for creating a new request.
type CreateRequestDTO struct {
	PartnerID     int  `json:"partner_id" validate:"required"`
	DistributorID *int `json:"distributor_id"`
	EndClientID   *int `json:"end_client_id"`
	// Fields for searching or creating the final client
	EndClientINN            *string `json:"end_client_inn" validate:"omitempty,min=10,max=12"`
	EndClientName           *string `json:"end_client_name" validate:"required_if=EndClientID nil"`
	EndClientCity           *string `json:"end_client_city"`
	EndClientFullAddress    *string `json:"end_client_full_address"`
	EndClientContactDetails *string `json:"end_client_contact_details"`

	EndClientDetailsOverride *string    `json:"end_client_details_override"`
	PartnerContactOverride   *string    `json:"partner_contact_override"`
	FZLawType                *string    `json:"fz_law_type"`
	MPTRegistryType          *string    `json:"mpt_registry_type"`
	PartnerActivities        *string    `json:"partner_activities"`
	DealStateDescription     *string    `json:"deal_state_description" validate:"required"`
	EstimatedCloseDate       *time.Time `json:"estimated_close_date"`

	// New fields
	ProjectName *string `json:"project_name"`
	Quantity    *int    `json:"quantity" validate:"omitempty,min=1"`
	UnitPrice   *string `json:"unit_price" validate:"omitempty"` // Принимаем как строку
}

// CreateRequest godoc
// @Summary Получить детали заявки
// ... (other endpoints can be left untouched)

// @Failure 500 {object} object{error=string} "Внутренняя ошибка сервера"
// @Router /requests [post]
func (h *RequestHandler) CreateRequest(c *gin.Context) {
	// 1. Получаем ID пользователя из контекста (установлено в middleware)
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID, ok := userIDVal.(int)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID in context"})
		return
	}

	// 1.5 Обработка файлов (если есть)
	if err := c.Request.ParseMultipartForm(32 << 20); err != nil { // 32MB limit
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse multipart form: " + err.Error()})
		return
	}

	var fileIDs []int
	// Ключ 'overall_tz_files[]' используется для поддержки нескольких файлов
	uploadedFiles := c.Request.MultipartForm.File["overall_tz_files[]"]

	for _, fileHeader := range uploadedFiles {
		file, err := fileHeader.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open uploaded file"})
			return
		}
		defer file.Close()

		fileData, err := io.ReadAll(file)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file data"})
			return
		}

		newFile := models.File{
			FileName: fileHeader.Filename,
			MimeType: fileHeader.Header.Get("Content-Type"),
			FileSize: fileHeader.Size,
			FileData: fileData,
		}

		createdFileID, err := h.repo.CreateFile(c.Request.Context(), &newFile)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file: " + err.Error()})
			return
		}
		fileIDs = append(fileIDs, createdFileID)
	}

	// 2. Декодируем JSON-данные из поля 'request_data'
	var dto CreateRequestDTO
	jsonData := c.PostForm("request_data")
	if err := json.Unmarshal([]byte(jsonData), &dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON data: " + err.Error()})
		return
	}

	// 3. Validate DTO
	if err := h.validator.Struct(dto); err != nil {
		errors := h.formatValidationErrors(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed", "details": errors})
		return
	}

	// 4. Calculate TotalPrice if Quantity and UnitPrice exist
	var totalPrice *decimal.Decimal
	var unitPriceDecimal *decimal.Decimal

	if dto.UnitPrice != nil && *dto.UnitPrice != "" {
		up, err := decimal.NewFromString(*dto.UnitPrice)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid unit_price format"})
			return
		}
		unitPriceDecimal = &up
	}

	if dto.Quantity != nil && unitPriceDecimal != nil {
		qty := decimal.NewFromInt32(int32(*dto.Quantity))
		res := qty.Mul(*unitPriceDecimal)
		totalPrice = &res
	}

	// 5. Create Request model from DTO
	req := models.Request{
		PartnerUserID:            userID,
		PartnerID:                dto.PartnerID,
		EndClientID:              dto.EndClientID,
		EndClientDetailsOverride: dto.EndClientDetailsOverride,
		DistributorID:            dto.DistributorID,
		PartnerContactOverride:   dto.PartnerContactOverride,
		FZLawType:                dto.FZLawType,
		MPTRegistryType:          dto.MPTRegistryType,
		PartnerActivities:        dto.PartnerActivities,
		DealStateDescription:     dto.DealStateDescription,
		EstimatedCloseDate:       dto.EstimatedCloseDate,
		Status:                   "На рассмотрении", // Initial status
		ProjectName:              dto.ProjectName,
		Quantity:                 dto.Quantity,
		UnitPrice:                unitPriceDecimal,
		TotalPrice:               totalPrice,
	}

	// If EndClientID is not provided but EndClientINN exists, find or create the client
	if dto.EndClientID == nil && dto.EndClientINN != nil && *dto.EndClientINN != "" {
		client, err := h.repo.FindEndClientByINN(c.Request.Context(), *dto.EndClientINN)
		if err != nil {
			// Предполагаем, что ошибка означает "не найдено", создаем нового
			newClient := models.EndClient{
				Name:                 *dto.EndClientName,
				INN:                  dto.EndClientINN,
				City:                 dto.EndClientCity,
				FullAddress:          dto.EndClientFullAddress,
				ContactPersonDetails: dto.EndClientContactDetails,
			}
			createdEndClientID, err := h.repo.CreateEndClient(c.Request.Context(), &newClient)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create end client: " + err.Error()})
				return
			}
			req.EndClientID = &createdEndClientID
		} else if client != nil {
			req.EndClientID = &client.ID
		}
	}

	// 6. Save request to repository, passing file IDs
	if err := h.repo.CreateRequest(c.Request.Context(), &req, fileIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request: " + err.Error()})
		return
	}

	// 7. Return created request (already with ID)
	c.JSON(http.StatusCreated, req)
}

// GetRequest godoc
// @Summary Получить детали заявки
// ... (other endpoints can be left untouched)

func (h *RequestHandler) formatValidationErrors(err error) map[string]string {
	// ... (implementation of error formatting)
	errors := make(map[string]string)
	for _, err := range err.(validator.ValidationErrors) {
		errors[err.Field()] = err.Tag()
	}
	return errors
}
