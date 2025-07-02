package requests

import "github.com/eeephemera/zvk-requests/server/db"

// RequestHandler содержит зависимости для обработчиков запросов.
type RequestHandler struct {
	Repo          *db.RequestRepository
	UserRepo      *db.UserRepository
	PartnerRepo   *db.PartnerRepository // Добавлено, если нужно для логики
	EndClientRepo *db.EndClientRepository
}

// NewRequestHandler создает новый RequestHandler.
// Принимает все необходимые репозитории.
func NewRequestHandler(
	repo *db.RequestRepository,
	userRepo *db.UserRepository,
	partnerRepo *db.PartnerRepository,
	endClientRepo *db.EndClientRepository,
) *RequestHandler {
	return &RequestHandler{
		Repo:          repo,
		UserRepo:      userRepo,
		PartnerRepo:   partnerRepo,
		EndClientRepo: endClientRepo,
	}
}

// Здесь могут быть другие общие функции или типы для пакета requests
