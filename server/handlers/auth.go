package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/eeephemera/zvk-requests/server/db"
	"github.com/eeephemera/zvk-requests/server/middleware"
	"github.com/eeephemera/zvk-requests/server/models"
	"github.com/eeephemera/zvk-requests/server/utils"
	"github.com/golang-jwt/jwt/v5"
)

// DTO для запросов
type RegisterRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type LoginRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

// Определяем структуру ответа для LoginUser, которая включает данные пользователя
type LoginResponse struct {
	Message string       `json:"message"`
	User    *models.User `json:"user"`
}

// setTokenCookie устанавливает JWT-токен в HttpOnly cookie.
func setTokenCookie(w http.ResponseWriter, tokenString string) {
	// Определяем, нужно ли ставить флаг Secure
	isProduction := os.Getenv("APP_ENV") == "production"

	// Задаем время жизни токена из переменной окружения или используем значение по умолчанию
	expirationStr := os.Getenv("JWT_EXPIRATION")
	expiration, err := time.ParseDuration(expirationStr)
	if err != nil {
		expiration = 72 * time.Hour // Значение по умолчанию
	}

	cookie := &http.Cookie{
		Name:     "token",
		Value:    tokenString,
		Expires:  time.Now().Add(expiration),
		HttpOnly: true,
		Secure:   isProduction, // Secure=true только в продакшене (HTTPS)
		Path:     "/",
		// Для работы с кросс-доменным фронтендом (Vercel) требуется SameSite=None
		SameSite: http.SameSiteNoneMode,
	}
	http.SetCookie(w, cookie)
}

// --- Предполагаемые интерфейсы ---
// (Вставьте сюда или в отдельный файл ваши реальные интерфейсы, если они есть)
type UserRepositoryInterface interface {
	GetUserByID(ctx context.Context, id int) (*models.User, error)
}

type PartnerRepositoryInterface interface {
	GetPartnerByID(ctx context.Context, id int) (*models.Partner, error)
}

// --- Предполагаемая структура обработчика ---
// (Замените на вашу реальную структуру)
type AuthHandler struct {
	UserRepo    *db.UserRepository
	PartnerRepo *db.PartnerRepository
}

// NewAuthHandler создает новый экземпляр AuthHandler.
func NewAuthHandler(userRepo *db.UserRepository, partnerRepo *db.PartnerRepository) *AuthHandler {
	return &AuthHandler{UserRepo: userRepo, PartnerRepo: partnerRepo}
}

// RegisterUser обрабатывает регистрацию новых пользователей.
func (h *AuthHandler) RegisterUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Login                string `json:"login"`
		Password             string `json:"password"`
		PasswordConfirmation string `json:"password_confirmation"`
		Role                 string `json:"role,omitempty"` // Роль опциональна, по умолчанию 'USER'
		PartnerID            *int   `json:"partner_id,omitempty"`
		Name                 string `json:"name,omitempty"`
		Email                string `json:"email,omitempty"`
		Phone                string `json:"phone,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Валидация, что пароли совпадают
	if req.Password != req.PasswordConfirmation {
		RespondWithError(w, http.StatusBadRequest, "Пароли не совпадают")
		return
	}

	// Валидация
	if err := utils.ValidatePassword(req.Password); err != nil {
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.Login) < 3 {
		RespondWithError(w, http.StatusBadRequest, "Login must be at least 3 characters long")
		return
	}

	// Хеширование пароля
	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		log.Printf("Password hashing failed: %v", err)
		RespondWithError(w, http.StatusInternalServerError, "Registration failed")
		return
	}

	// Создаем пользователя
	user := &models.User{
		Login:        req.Login,
		PasswordHash: hashedPassword,
		Role:         models.RoleUser,
		PartnerID:    req.PartnerID,
		Name:         &req.Name,
		// Email будет обработан ниже, чтобы разрешить NULL значения
		Phone: &req.Phone,
	}

	// Если email предоставлен, устанавливаем его.
	// Иначе он останется nil, что приведет к записи NULL в базу данных.
	if req.Email != "" {
		user.Email = &req.Email
	}

	if err := h.UserRepo.CreateUser(r.Context(), user); err != nil {
		// Проверяем, является ли ошибка ошибкой нарушения уникальности
		if db.IsUniqueConstraintViolation(err, "users_login_key") {
			RespondWithError(w, http.StatusConflict, "User with this login already exists")
			return
		}
		log.Printf("Failed to create user: %v", err)
		RespondWithError(w, http.StatusInternalServerError, "Registration failed")
		return
	}

	// Не возвращаем хеш пароля
	user.PasswordHash = ""

	RespondWithJSON(w, http.StatusCreated, user)
}

// LoginUser обрабатывает аутентификацию пользователей.
func (h *AuthHandler) LoginUser(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Поиск пользователя в БД через репозиторий
	user, err := h.UserRepo.GetUserByLogin(r.Context(), req.Login)
	if err != nil {
		if err == db.ErrNotFound {
			log.Printf("Login attempt failed for non-existent user: %s", req.Login)
			time.Sleep(time.Duration(300+utils.RandomInt(500)) * time.Millisecond) // Защита от тайминг-атак
			RespondWithError(w, http.StatusUnauthorized, "Invalid credentials")
		} else {
			log.Printf("Error fetching user by login %s: %v", req.Login, err)
			RespondWithError(w, http.StatusInternalServerError, "Login failed")
		}
		return
	}

	// Проверка пароля
	if err := utils.CheckPasswordHash(req.Password, user.PasswordHash); err != nil {
		log.Printf("Password mismatch for user %s", user.Login)
		time.Sleep(time.Duration(300+utils.RandomInt(500)) * time.Millisecond) // Защита от тайминг-атак
		RespondWithError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	// Получаем время жизни токена из переменной окружения
	expirationStr := os.Getenv("JWT_EXPIRATION")
	expiration, err := time.ParseDuration(expirationStr)
	if err != nil {
		expiration = 72 * time.Hour // Значение по умолчанию
	}

	// Включаем "jti" (JWT ID) для предотвращения повторного использования токена
	tokenID := utils.GenerateSecureRandomString(16)

	// Формируем claims с ролью типа UserRole и дополнительной информацией для безопасности
	claims := jwt.MapClaims{
		"id":    user.ID,
		"login": user.Login,
		"role":  user.Role, // Передаем UserRole напрямую (будет как строка в JWT)
		"jti":   tokenID,   // Уникальный ID токена
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(expiration).Unix(),
	}

	// Генерация JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(middleware.GetJWTSecret())
	if err != nil {
		log.Printf("JWT generation failed: %v", err)
		RespondWithError(w, http.StatusInternalServerError, "Login failed")
		return
	}

	// Устанавливаем куку с токеном
	setTokenCookie(w, tokenString)

	// Возвращаем данные пользователя в ответе
	user.PasswordHash = "" // Убираем хеш перед отправкой
	RespondWithJSON(w, http.StatusOK, LoginResponse{
		Message: "Login successful",
		User:    user,
	})
}

// RefreshToken обновляет JWT токен.
func RefreshToken(w http.ResponseWriter, r *http.Request) {
	// Извлекаем данные из контекста (заполняются в middleware.ValidateToken)
	ctx := r.Context()
	userID, ok := ctx.Value(middleware.UserIDKey).(int)
	if !ok {
		http.Error(w, "Invalid user ID", http.StatusUnauthorized)
		return
	}

	roleValue := ctx.Value(middleware.RoleKey)
	role, ok := roleValue.(models.UserRole) // Ожидаем UserRole
	if !ok {
		// Попытка преобразовать строку, если в токене строка
		roleStr, okStr := roleValue.(string)
		if okStr {
			role = models.UserRole(roleStr)
		} else {
			http.Error(w, "Invalid user role type in context", http.StatusUnauthorized)
			return
		}
	}

	// Получаем время жизни токена из переменной окружения
	expirationStr := os.Getenv("JWT_EXPIRATION")
	expiration, err := time.ParseDuration(expirationStr)
	if err != nil {
		expiration = 72 * time.Hour // Значение по умолчанию
	}

	// Включаем "jti" (JWT ID) для предотвращения повторного использования токена
	tokenID := utils.GenerateSecureRandomString(16)

	// Генерация нового токена с полной информацией безопасности
	claims := jwt.MapClaims{
		"id":   userID,
		"role": role,
		"jti":  tokenID, // Уникальный ID токена
		"iat":  time.Now().Unix(),
		"exp":  time.Now().Add(expiration).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(middleware.GetJWTSecret())
	if err != nil {
		log.Printf("Token refresh failed: %v", err)
		http.Error(w, "Token refresh failed", http.StatusInternalServerError)
		return
	}

	// Обновляем куку с новым токеном
	setTokenCookie(w, tokenString)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Token refreshed",
	})
}

// Me возвращает информацию о текущем пользователе
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	// Получаем ID пользователя из контекста
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		RespondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Получаем данные пользователя
	user, err := h.UserRepo.GetUserByID(r.Context(), userID)
	if err != nil {
		log.Printf("Error fetching user data: %v", err)
		http.Error(w, "Failed to fetch user data", http.StatusInternalServerError)
		return
	}

	// Если у пользователя есть partner_id, получаем данные партнера
	if user.PartnerID != nil {
		partner, err := h.PartnerRepo.GetPartnerByID(r.Context(), *user.PartnerID)
		if err != nil {
			log.Printf("Error fetching partner data: %v", err)
			// Не блокируем ответ, если партнера не удалось найти, просто не добавляем его
		} else {
			user.Partner = partner
		}
	}

	// Убираем хеш перед отправкой
	user.PasswordHash = ""

	RespondWithJSON(w, http.StatusOK, user)
}

func LogoutUser(w http.ResponseWriter, r *http.Request) {
	// Создаем cookie с истекшим сроком действия
	cookie := &http.Cookie{
		Name:     "token",
		Value:    "",
		Expires:  time.Unix(0, 0), // Время в прошлом
		HttpOnly: true,
		Secure:   os.Getenv("APP_ENV") == "production", // Secure для продакшена
		Path:     "/",
		// Важно: для удаления кросс-доменной куки нужно отдать её с теми же атрибутами SameSite=None
		SameSite: http.SameSiteNoneMode,
	}
	http.SetCookie(w, cookie)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Logged out successfully",
	})
}
