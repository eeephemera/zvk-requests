package requests

import "github.com/eeephemera/zvk-requests/db"

// RequestHandler содержит методы для обработки запросов
type RequestHandler struct {
	Repo *db.RequestRepository
}
