package requests

import "github.com/eeephemera/zvk-requests/db"

// RequestHandler содержит зависимости для обработчиков запросов.
type RequestHandler struct {
	Repo          *db.RequestRepository
	UserRepo      *db.UserRepository
	PartnerRepo   *db.PartnerRepository // Добавлено, если нужно для логики
	EndClientRepo *db.EndClientRepository
	ProductRepo   *db.ProductRepository // Добавлено, если нужно для логики
}

// NewRequestHandler создает новый RequestHandler.
// Принимает все необходимые репозитории.
func NewRequestHandler(
	repo *db.RequestRepository,
	userRepo *db.UserRepository,
	partnerRepo *db.PartnerRepository,
	endClientRepo *db.EndClientRepository,
	productRepo *db.ProductRepository,
) *RequestHandler {
	return &RequestHandler{
		Repo:          repo,
		UserRepo:      userRepo,
		PartnerRepo:   partnerRepo,
		EndClientRepo: endClientRepo,
		ProductRepo:   productRepo,
	}
}

// Здесь могут быть другие общие функции или типы для пакета requests
