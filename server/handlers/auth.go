package handlers

import (
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
func setTokenCookie(w http.ResponseWriter, tokenString string, sameSite http.SameSite) {
	cookie := &http.Cookie{
		Name:     "token",
		Value:    tokenString,
		Expires:  time.Now().Add(72 * time.Hour),
		HttpOnly: true,
		Secure:   true, // Для разработки по HTTP
		// Domain можно не указывать для локальной разработки
		SameSite: sameSite,
	}
	http.SetCookie(w, cookie)
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

	// Устанавливаем роль пользователя принудительно
	role := string(models.RoleUser)

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
		role, // Всегда "Пользователь"
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

	// Генерация JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"id":    user.ID,
		"login": user.Login,
		"role":  user.Role,
		"exp":   time.Now().Add(72 * time.Hour).Unix(),
	})
	// Подписываем JWT тем же секретом, который использует middleware
	tokenString, err := token.SignedString(middleware.GetJWTSecret())
	if err != nil {
		log.Printf("JWT generation failed: %v", err)
		http.Error(w, "Login failed", http.StatusInternalServerError)
		return
	}

	// Устанавливаем куку с токеном. Для логина используем SameSiteNoneMode.
	setTokenCookie(w, tokenString, http.SameSiteNoneMode)

	// Ответ
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Login successful",
		"role":    user.Role,
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
		"exp":  time.Now().Add(72 * time.Hour).Unix(),
	})
	tokenString, err := token.SignedString(middleware.GetJWTSecret())
	if err != nil {
		log.Printf("Token refresh failed: %v", err)
		http.Error(w, "Token refresh failed", http.StatusInternalServerError)
		return
	}

	// Обновляем куку с новым токеном. Для обновления используем SameSiteLaxMode.
	setTokenCookie(w, tokenString, http.SameSiteLaxMode)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"token": tokenString,
	})
}

func Me(w http.ResponseWriter, r *http.Request) {
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

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":   userID,
		"role": role,
	})
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
		SameSite: http.SameSiteNoneMode,
	}
	http.SetCookie(w, cookie)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Logged out successfully"})
}
