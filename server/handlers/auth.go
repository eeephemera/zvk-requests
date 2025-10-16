package handlers

import (
	"context"
	"encoding/json"
	"log"
	"log/slog"
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
	// Role и PartnerID на self-signup игнорируются
	Role string `json:"role"`
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
	if err != nil || expiration <= 0 {
		expiration = 60 * time.Minute // Значение по умолчанию: 60m
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
	// CSRF токен теперь возвращается в JSON ответе, не в cookie
}

// setRefreshCookie устанавливает refresh-токен в HttpOnly cookie с более длительным TTL.
func setRefreshCookie(w http.ResponseWriter, tokenString string) {
	isProduction := os.Getenv("APP_ENV") == "production"
	refreshStr := os.Getenv("REFRESH_EXPIRATION")
	refreshTTL, err := time.ParseDuration(refreshStr)
	if err != nil || refreshTTL <= 0 {
		refreshTTL = 30 * 24 * time.Hour // 30d по умолчанию
	}
	cookie := &http.Cookie{
		Name:     "refresh_token",
		Value:    tokenString,
		Expires:  time.Now().Add(refreshTTL),
		HttpOnly: true,
		Secure:   isProduction,
		Path:     "/",
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
	logger := slog.With("handler", "RegisterUser", "method", r.Method, "path", r.URL.Path)

	var req struct {
		Login                string `json:"login"`
		Password             string `json:"password"`
		PasswordConfirmation string `json:"password_confirmation"`
		// Игнорируемые поля на self-signup (оставлены для совместимости DTO)
		Role      string `json:"role,omitempty"`
		PartnerID *int   `json:"partner_id,omitempty"`
		Name      string `json:"name,omitempty"`
		Email     string `json:"email,omitempty"`
		Phone     string `json:"phone,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Warn("Invalid request body", "error", err)
		RespondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Валидация, что пароли совпадают
	if req.Password != req.PasswordConfirmation {
		logger.Warn("Password confirmation mismatch")
		RespondWithError(w, http.StatusBadRequest, "Пароли не совпадают")
		return
	}

	// Валидация
	if err := utils.ValidatePassword(req.Password); err != nil {
		logger.Warn("Password validation failed", "error", err)
		RespondWithError(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(req.Login) < 3 {
		logger.Warn("Login too short", "login_length", len(req.Login))
		RespondWithError(w, http.StatusBadRequest, "Login must be at least 3 characters long")
		return
	}

	// Хеширование пароля
	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		logger.Error("Password hashing failed", "error", err)
		RespondWithError(w, http.StatusInternalServerError, "Registration failed")
		return
	}

	// Создаем пользователя. Насильно фиксируем безопасные значения
	user := &models.User{
		Login:        req.Login,
		PasswordHash: hashedPassword,
		Role:         models.RoleUser, // игнорируем присланную роль
		PartnerID:    nil,             // запрет самопривязки к партнёру
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
			logger.Warn("User registration failed - login already exists", "login", req.Login)
			RespondWithError(w, http.StatusConflict, "User with this login already exists")
			return
		}
		logger.Error("Failed to create user", "login", req.Login, "error", err)
		RespondWithError(w, http.StatusInternalServerError, "Registration failed")
		return
	}

	// Не возвращаем хеш пароля
	user.PasswordHash = ""

	logger.Info("User registered successfully", "user_id", user.ID, "login", user.Login, "role", user.Role)
	RespondWithJSON(w, http.StatusCreated, user)
}

// LoginUser обрабатывает аутентификацию пользователей.
func (h *AuthHandler) LoginUser(w http.ResponseWriter, r *http.Request) {
	logger := slog.With("handler", "LoginUser", "method", r.Method, "path", r.URL.Path)

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Warn("Invalid request body", "error", err)
		RespondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Поиск пользователя в БД через репозиторий
	user, err := h.UserRepo.GetUserByLogin(r.Context(), req.Login)
	if err != nil {
		if err == db.ErrNotFound {
			logger.Warn("Login attempt failed - user not found", "login", req.Login)
			time.Sleep(time.Duration(300+utils.RandomInt(500)) * time.Millisecond) // Защита от тайминг-атак
			RespondWithError(w, http.StatusUnauthorized, "Invalid credentials")
		} else {
			logger.Error("Error fetching user by login", "login", req.Login, "error", err)
			RespondWithError(w, http.StatusInternalServerError, "Login failed")
		}
		return
	}

	// Проверка пароля
	if err := utils.CheckPasswordHash(req.Password, user.PasswordHash); err != nil {
		logger.Warn("Password mismatch", "user_id", user.ID, "login", user.Login)
		time.Sleep(time.Duration(300+utils.RandomInt(500)) * time.Millisecond) // Защита от тайминг-атак
		RespondWithError(w, http.StatusUnauthorized, "Invalid credentials")
		return
	}

	// Ре-хеш, если нужно (миграция cost)
	if utils.NeedsRehash(user.PasswordHash) {
		if newHash, err := utils.HashPassword(req.Password); err == nil {
			_ = h.UserRepo.UpdatePasswordHash(r.Context(), user.ID, newHash)
		}
	}

	// Время жизни access токена
	expirationStr := os.Getenv("JWT_EXPIRATION")
	expiration, err := time.ParseDuration(expirationStr)
	if err != nil || expiration <= 0 {
		expiration = 60 * time.Minute
	}
	// Время жизни refresh токена
	refreshStr := os.Getenv("REFRESH_EXPIRATION")
	refreshTTL, err := time.ParseDuration(refreshStr)
	if err != nil || refreshTTL <= 0 {
		refreshTTL = 30 * 24 * time.Hour
	}

	// JTI для токенов
	accessJTI := utils.GenerateSecureRandomString(16)
	refreshJTI := utils.GenerateSecureRandomString(24)

	// Формируем access claims
	accessClaims := jwt.MapClaims{
		"id":    user.ID,
		"login": user.Login,
		"role":  user.Role,
		"jti":   accessJTI,
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(expiration).Unix(),
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessString, err := accessToken.SignedString(middleware.GetJWTSecret())
	if err != nil {
		log.Printf("JWT generation failed: %v", err)
		RespondWithError(w, http.StatusInternalServerError, "Login failed")
		return
	}

	// Формируем refresh claims
	refreshClaims := jwt.MapClaims{
		"id":  user.ID,
		"jti": refreshJTI,
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(refreshTTL).Unix(),
		"typ": "refresh",
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshString, err := refreshToken.SignedString(middleware.GetJWTSecret())
	if err != nil {
		log.Printf("Refresh JWT generation failed: %v", err)
		RespondWithError(w, http.StatusInternalServerError, "Login failed")
		return
	}

	// Ставим куки
	setTokenCookie(w, accessString)
	setRefreshCookie(w, refreshString)

	// Логируем успешный вход
	logger.Info("User logged in successfully", "user_id", user.ID, "login", user.Login, "role", user.Role)

	// Возвращаем данные пользователя в ответе
	user.PasswordHash = ""
	RespondWithJSON(w, http.StatusOK, LoginResponse{
		Message: "Login successful",
		User:    user,
		// CSRF токен больше не нужен - клиент генерирует свой session-based токен
	})
}

// RefreshToken обновляет JWT токены (access и refresh) с ротацией.
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	logger := slog.With("handler", "RefreshToken", "method", r.Method, "path", r.URL.Path)

	// Берем refresh_token из cookies
	refreshCookie, err := r.Cookie("refresh_token")
	if err != nil || refreshCookie.Value == "" {
		logger.Warn("Missing refresh token")
		http.Error(w, "Missing refresh token", http.StatusUnauthorized)
		return
	}

	parser := jwt.NewParser(jwt.WithValidMethods([]string{"HS256"}))
	token, err := parser.Parse(refreshCookie.Value, func(token *jwt.Token) (interface{}, error) {
		return middleware.GetJWTSecret(), nil
	})
	if err != nil || !token.Valid {
		logger.Warn("Invalid refresh token", "error", err)
		http.Error(w, "Invalid refresh token", http.StatusUnauthorized)
		return
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		logger.Error("Invalid refresh token claims")
		http.Error(w, "Invalid refresh token claims", http.StatusUnauthorized)
		return
	}
	if typ, _ := claims["typ"].(string); typ != "refresh" {
		logger.Warn("Wrong token type", "token_type", typ)
		http.Error(w, "Wrong token type", http.StatusUnauthorized)
		return
	}
	// Проверка истечения
	if exp, ok := claims["exp"].(float64); ok {
		if time.Now().After(time.Unix(int64(exp), 0)) {
			http.Error(w, "Refresh token expired", http.StatusUnauthorized)
			return
		}
	}
	// Проверка jti на отзыв
	if oldJTI, ok := claims["jti"].(string); ok && middleware.IsJTIRevoked(r.Context(), oldJTI) {
		http.Error(w, "Refresh token revoked", http.StatusUnauthorized)
		return
	}

	// Извлекаем user id
	uidFloat, ok := claims["id"].(float64)
	if !ok {
		http.Error(w, "Invalid user in token", http.StatusUnauthorized)
		return
	}
	userID := int(uidFloat)

	// Получаем данные пользователя из БД для роли и логина
	user, err := h.UserRepo.GetUserByID(r.Context(), userID)
	if err != nil {
		logger.Error("Failed to fetch user for refresh", "user_id", userID, "error", err)
		http.Error(w, "Failed to fetch user data", http.StatusInternalServerError)
		return
	}

	// Время жизни
	expirationStr := os.Getenv("JWT_EXPIRATION")
	expiration, err := time.ParseDuration(expirationStr)
	if err != nil || expiration <= 0 {
		expiration = 60 * time.Minute
	}
	refreshStr := os.Getenv("REFRESH_EXPIRATION")
	refreshTTL, err := time.ParseDuration(refreshStr)
	if err != nil || refreshTTL <= 0 {
		refreshTTL = 30 * 24 * time.Hour
	}

	// Ротация: отзываем старый refresh jti
	if oldJTI, ok := claims["jti"].(string); ok {
		// Отзываем до конца изначального TTL
		if exp, ok := claims["exp"].(float64); ok {
			middleware.BlacklistJTI(r.Context(), oldJTI, time.Unix(int64(exp), 0))
		}
	}

	// Сгенерируем новые токены
	newAccessJTI := utils.GenerateSecureRandomString(16)
	newRefreshJTI := utils.GenerateSecureRandomString(24)

	accessClaims := jwt.MapClaims{
		"id":    userID,
		"login": user.Login,
		"role":  user.Role,
		"jti":   newAccessJTI,
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(expiration).Unix(),
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessString, err := accessToken.SignedString(middleware.GetJWTSecret())
	if err != nil {
		http.Error(w, "Failed to issue access token", http.StatusInternalServerError)
		return
	}

	refreshClaims := jwt.MapClaims{
		"id":  userID,
		"jti": newRefreshJTI,
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(refreshTTL).Unix(),
		"typ": "refresh",
	}
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshString, err := refreshToken.SignedString(middleware.GetJWTSecret())
	if err != nil {
		http.Error(w, "Failed to issue refresh token", http.StatusInternalServerError)
		return
	}

	setTokenCookie(w, accessString)
	setRefreshCookie(w, refreshString)

	logger.Info("Token refreshed successfully", "user_id", userID, "new_access_jti", newAccessJTI, "new_refresh_jti", newRefreshJTI)

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "Token refreshed",
	})
}

// Me возвращает информацию о текущем пользователе
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	logger := slog.With("handler", "Me", "method", r.Method, "path", r.URL.Path)

	// Получаем ID пользователя из контекста
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		logger.Warn("User not authenticated")
		RespondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

	// Получаем данные пользователя
	user, err := h.UserRepo.GetUserByID(r.Context(), userID)
	if err != nil {
		logger.Error("Error fetching user data", "user_id", userID, "error", err)
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

	logger.Info("User data retrieved successfully", "user_id", user.ID, "login", user.Login, "role", user.Role)
	RespondWithJSON(w, http.StatusOK, user)
}

func LogoutUser(w http.ResponseWriter, r *http.Request) {
	logger := slog.With("handler", "LogoutUser", "method", r.Method, "path", r.URL.Path)

	// Попробуем отозвать текущие JTIs из access и refresh cookie
	if c, err := r.Cookie("token"); err == nil {
		if tok, err := jwt.Parse(c.Value, func(token *jwt.Token) (interface{}, error) { return middleware.GetJWTSecret(), nil }); err == nil && tok.Valid {
			if cl, ok := tok.Claims.(jwt.MapClaims); ok {
				if jti, ok := cl["jti"].(string); ok {
					if exp, ok := cl["exp"].(float64); ok {
						middleware.BlacklistJTI(r.Context(), jti, time.Unix(int64(exp), 0))
					}
				}
			}
		}
	}
	if c, err := r.Cookie("refresh_token"); err == nil {
		if tok, err := jwt.Parse(c.Value, func(token *jwt.Token) (interface{}, error) { return middleware.GetJWTSecret(), nil }); err == nil && tok.Valid {
			if cl, ok := tok.Claims.(jwt.MapClaims); ok {
				if jti, ok := cl["jti"].(string); ok {
					if exp, ok := cl["exp"].(float64); ok {
						middleware.BlacklistJTI(r.Context(), jti, time.Unix(int64(exp), 0))
					}
				}
			}
		}
	}

	// Очищаем куки
	cookie := &http.Cookie{
		Name:     "token",
		Value:    "",
		Expires:  time.Unix(0, 0),
		HttpOnly: true,
		Secure:   os.Getenv("APP_ENV") == "production",
		Path:     "/",
		SameSite: http.SameSiteNoneMode,
	}
	http.SetCookie(w, cookie)
	refresh := *cookie
	refresh.Name = "refresh_token"
	http.SetCookie(w, &refresh)

	logger.Info("User logged out successfully")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"message": "Logged out successfully",
	})
}
