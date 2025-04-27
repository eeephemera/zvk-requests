package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
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

// setTokenCookie устанавливает JWT-токен в HttpOnly cookie с указанной политикой SameSite.
func setTokenCookie(w http.ResponseWriter, tokenString string) {
	cookie := &http.Cookie{
		Name:     "token",
		Value:    tokenString,
		Expires:  time.Now().Add(72 * time.Hour),
		HttpOnly: true,
		Secure:   true, // Оставляем Secure=true, т.к. SameSite=None требует его, а Lax/Strict - рекомендуют
		Path:     "/",  // Явно указываем Path
		// Domain можно не указывать для localhost
		SameSite: http.SameSiteLaxMode, // Всегда используем Lax для лучшей совместимости на localhost
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
	role := models.RoleUser // Теперь это строка "USER"

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
		role, // Передаем строку role
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
	json.NewEncoder(w).Encode(user) // Возвращаем всего юзера (где role уже строка)
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
        SELECT id, login, password_hash, role, created_at 
        FROM users 
        WHERE login = $1
    `
	err = conn.QueryRow(r.Context(), query, req.Login).Scan(
		&user.ID,
		&user.Login,
		&user.PasswordHash,
		&user.Role,
		&user.CreatedAt,
	)
	if err != nil {
		log.Printf("Login error: %v", err)
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Проверка пароля
	if err := utils.CheckPasswordHash(req.Password, user.PasswordHash); err != nil {
		log.Printf("Password mismatch for user %s", user.Login)
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Формируем claims с строковой ролью
	claims := jwt.MapClaims{
		"id":    user.ID,
		"login": user.Login,
		"role":  user.Role, // Передаем строку user.Role напрямую
		"exp":   time.Now().Add(72 * time.Hour).Unix(),
	}

	// Генерация JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	// Подписываем JWT тем же секретом, который использует middleware
	tokenString, err := token.SignedString(middleware.GetJWTSecret())
	if err != nil {
		log.Printf("JWT generation failed: %v", err)
		http.Error(w, "Login failed", http.StatusInternalServerError)
		return
	}

	// Устанавливаем куку с токеном
	setTokenCookie(w, tokenString)

	// Ответ со строковой ролью
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Login successful",
		"role":    user.Role, // Возвращаем строку user.Role напрямую
		"id":      user.ID,
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

	role, ok := ctx.Value(middleware.RoleKey).(string)
	if !ok {
		http.Error(w, "Invalid user role", http.StatusUnauthorized)
		return
	}

	// Генерация нового токена
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":   userID,
		"role": role,
		"exp":  time.Now().Add(1 * time.Minute).Unix(),
	})
	tokenString, err := token.SignedString(middleware.GetJWTSecret())
	if err != nil {
		log.Printf("Token refresh failed: %v", err)
		http.Error(w, "Token refresh failed", http.StatusInternalServerError)
		return
	}

	// Обновляем куку с новым токеном. Используем setTokenCookie, которая теперь всегда ставит Lax.
	setTokenCookie(w, tokenString) // Передаваемый SameSite игнорируется функцией

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"token": tokenString,
	})
}

// Me возвращает информацию о текущем пользователе
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	userID, ok := ctx.Value(middleware.UserIDKey).(int)
	if !ok {
		RespondWithError(w, http.StatusUnauthorized, "Invalid user ID in context")
		return
	}

	// 1. Получаем полные данные пользователя из репозитория
	user, err := h.UserRepo.GetUserByID(ctx, userID)
	if err != nil {
		if err == db.ErrNotFound { // Используем стандартную ошибку репозитория
			RespondWithError(w, http.StatusNotFound, "User not found in database")
		} else {
			log.Printf("Error fetching user %d for /me: %v", userID, err)
			RespondWithError(w, http.StatusInternalServerError, "Failed to retrieve user data")
		}
		return
	}

	// 2. Создаем структуру для ответа
	type UserResponse struct {
		ID      int             `json:"id"`
		Name    string          `json:"name"` // Возвращаем строку, даже если в user указатель
		Email   string          `json:"email"`
		Phone   string          `json:"phone"`
		Role    models.UserRole `json:"role"`
		Partner *models.Partner `json:"partner,omitempty"`
	}

	// Функция-хелпер для безопасного разыменования указателя на строку
	ptrToString := func(s *string) string {
		if s != nil {
			return *s
		}
		return "" // Возвращаем пустую строку, если указатель nil
	}

	response := UserResponse{
		ID:    user.ID,
		Name:  ptrToString(user.Name),  // Используем хелпер
		Email: ptrToString(user.Email), // Используем хелпер
		Phone: ptrToString(user.Phone), // Используем хелпер
		Role:  user.Role,
	}

	// 3. Получаем данные партнера, если он есть
	if user.PartnerID != nil {
		partner, err := h.PartnerRepo.GetPartnerByID(ctx, *user.PartnerID)
		if err != nil {
			// Если партнер не найден или другая ошибка - логируем, но не прерываем запрос
			log.Printf("Warning: could not fetch partner %d for user %d in /me: %v", *user.PartnerID, userID, err)
		} else {
			response.Partner = partner // Присваиваем найденного партнера
		}
	}

	// 4. Отправляем успешный ответ
	RespondWithJSON(w, http.StatusOK, response)
}

func LogoutUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie := &http.Cookie{
		Name:     "token",
		Value:    "",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   true,
		Path:     "/",                  // Явно указываем Path и для удаления
		SameSite: http.SameSiteLaxMode, // Используем Lax и при удалении
	}
	http.SetCookie(w, cookie)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Logged out successfully"})
}
