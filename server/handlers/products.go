package handlers

import (
	"log"
	"net/http"

	"github.com/eeephemera/zvk-requests/db"
)

// ProductHandler - обработчик запросов для работы с продуктами
type ProductHandler struct {
	ProductRepo *db.ProductRepository
}

// NewProductHandler создает новый экземпляр ProductHandler
func NewProductHandler(productRepo *db.ProductRepository) *ProductHandler {
	return &ProductHandler{
		ProductRepo: productRepo,
	}
}

// ListProductsHandler обрабатывает запрос GET /api/products
// и возвращает список всех продуктов
func (h *ProductHandler) ListProductsHandler(w http.ResponseWriter, r *http.Request) {
	// Получаем список продуктов из базы данных
	products, err := h.ProductRepo.GetAllProducts(r.Context())
	if err != nil {
		log.Printf("Error getting products from database: %v", err)
		RespondWithError(w, http.StatusInternalServerError, "Ошибка при получении списка продуктов")
		return
	}

	// Возвращаем успешный ответ со списком продуктов
	RespondWithJSON(w, http.StatusOK, products)
}
