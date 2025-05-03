package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/eeephemera/zvk-requests/db"
	"github.com/eeephemera/zvk-requests/middleware"
	"github.com/eeephemera/zvk-requests/models"
	"github.com/eeephemera/zvk-requests/utils"
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
		SameSite: http.SameSiteLaxMode, // Lax - хороший баланс
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
	UserRepo    UserRepositoryInterface
	PartnerRepo PartnerRepositoryInterface
}

// RegisterUser обрабатывает регистрацию новых пользователей.
func RegisterUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Валидация логина
	if len(req.Login) < 3 {
		http.Error(w, "Логин должен содержать минимум 3 символа", http.StatusBadRequest)
		return
	}

	// Валидация пароля
	if err := utils.ValidatePassword(req.Password); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Хеширование пароля
	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		log.Printf("Password hashing failed: %v", err)
		http.Error(w, "Registration failed", http.StatusInternalServerError)
		return
	}

	// Устанавливаем роль пользователя принудительно как строку
	role := models.RoleUser // Используем константу типа UserRole

	// Сохранение в БД
	conn, err := db.GetDBConnection(r.Context())
	if err != nil {
		log.Printf("Database connection error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer conn.Release()

	query := `
        INSERT INTO users (login, password_hash, role, created_at) 
        VALUES ($1, $2, $3, $4) 
        RETURNING id, login, role, created_at
    `
	var user models.User
	err = conn.QueryRow(
		r.Context(),
		query,
		req.Login,
		hashedPassword,
		string(role), // Преобразуем UserRole в string для передачи в БД
		time.Now(),
	).Scan(&user.ID, &user.Login, &user.Role, &user.CreatedAt)

	if err != nil {
		log.Printf("Database error: %v", err)
		http.Error(w, "Registration failed", http.StatusInternalServerError)
		return
	}

	// Ответ без чувствительных данных
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	// Возвращаем пользователя (хеш пароля не включается благодаря `json:"-"`)
	json.NewEncoder(w).Encode(user)
}

// LoginUser обрабатывает аутентификацию пользователей.
func LoginUser(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Поиск пользователя в БД
	conn, err := db.GetDBConnection(r.Context())
	if err != nil {
		log.Printf("Database connection error: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	defer conn.Release()

	var user models.User
	query := `
        SELECT id, login, password_hash, role, name, email, phone, partner_id, created_at 
        FROM users 
        WHERE login = $1
    `
	err = conn.QueryRow(r.Context(), query, req.Login).Scan(
		&user.ID,
		&user.Login,
		&user.PasswordHash, // Получаем хеш для проверки
		&user.Role,
		&user.Name, // Получаем доп. поля
		&user.Email,
		&user.Phone,
		&user.PartnerID,
		&user.CreatedAt,
	)
	if err != nil {
		// Не сообщаем, что пользователь не существует
		// Используем одинаковые сообщения об ошибке для безопасности
		log.Printf("Login attempt failed for non-existent user: %s", req.Login)
		time.Sleep(time.Duration(300+utils.RandomInt(500)) * time.Millisecond) // Защита от тайминг-атак
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Проверка пароля
	if err := utils.CheckPasswordHash(req.Password, user.PasswordHash); err != nil {
		log.Printf("Password mismatch for user %s", user.Login)
		time.Sleep(time.Duration(300+utils.RandomInt(500)) * time.Millisecond) // Защита от тайминг-атак
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
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
		http.Error(w, "Login failed", http.StatusInternalServerError)
		return
	}

	// Устанавливаем куку с токеном
	setTokenCookie(w, tokenString)

	// Возвращаем данные пользователя в ответе
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(LoginResponse{
		Message: "Login successful",
		User:    &user, // Включаем полные данные пользователя (кроме хеша пароля)
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
		http.Error(w, "User ID not found in context", http.StatusUnauthorized)
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
			// Не возвращаем ошибку, продолжаем без данных партнера
		} else {
			user.Partner = partner
		}
	}

	// Возвращаем данные пользователя
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
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
		SameSite: http.SameSiteLaxMode,
	}
	http.SetCookie(w, cookie)

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Logged out successfully",
	})
}
