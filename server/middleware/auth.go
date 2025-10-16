// middleware/auth.go (пример)
package middleware

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/eeephemera/zvk-requests/server/models"
	"github.com/golang-jwt/jwt/v5"
)

// Ключи контекста
type contextKey string

const (
	UserIDKey      contextKey = "userID"
	RoleKey        contextKey = "role"
	TokenIDKey     contextKey = "tokenID"     // Новый ключ для JWT ID
	TokenIssuedKey contextKey = "tokenIssued" // Новый ключ для времени создания токена
)

// Глобальная переменная для хранения секрета
var jwtSecret []byte

// В памяти: черный список JTI (до указанного срока)
// Хранилище для отзывов JTI
type RevocationStore interface {
	IsRevoked(ctx context.Context, jti string) (bool, error)
	Revoke(ctx context.Context, jti string, expiresAt time.Time) error
}

var (
	revokedJTIs   = make(map[string]time.Time) // fallback in-memory
	revokedJTIsMu sync.Mutex
	store         RevocationStore
)

// SetRevocationStore настраивает внешнее хранилище отзывов токенов
func SetRevocationStore(s RevocationStore) {
	store = s
}

// Установить секретный ключ (вызывается из main.go)
func SetJWTSecret(secret string) {
	if secret == "" {
		log.Fatal("JWT_SECRET не может быть пустым")
	}
	jwtSecret = []byte(secret)
}

// Получить текущий секрет
func GetJWTSecret() []byte {
	return jwtSecret
}

// BlacklistJTI помечает jti отозванным до момента expiresAt.
func BlacklistJTI(ctx context.Context, jti string, expiresAt time.Time) {
	if store != nil {
		_ = store.Revoke(ctx, jti, expiresAt)
		return
	}
	revokedJTIsMu.Lock()
	revokedJTIs[jti] = expiresAt
	revokedJTIsMu.Unlock()
}

// IsJTIRevoked проверяет, отозван ли jti (и чистит просроченные записи).
func IsJTIRevoked(ctx context.Context, jti string) bool {
	if store != nil {
		ok, err := store.IsRevoked(ctx, jti)
		if err == nil {
			return ok
		}
		// on error fallback to in-memory
	}
	revokedJTIsMu.Lock()
	// Очистка просроченных
	now := time.Now()
	for k, v := range revokedJTIs {
		if now.After(v) {
			delete(revokedJTIs, k)
		}
	}
	exp, ok := revokedJTIs[jti]
	revokedJTIsMu.Unlock()
	return ok && now.Before(exp)
}

// ValidateToken — middleware для проверки JWT, извлекаемого из куки
func ValidateToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := slog.With(
			"path", r.URL.Path,
			"method", r.Method,
			"user_agent", r.UserAgent(),
		)

		cookie, err := r.Cookie("token")
		if err != nil {
			logger.Warn("Authorization cookie missing", "error", err.Error())
			http.Error(w, "Authorization cookie is missing", http.StatusUnauthorized)
			return
		}

		tokenString := cookie.Value

		// Добавляем проверку на минимальную длину, чтобы отсечь очевидно неверные токены
		if len(tokenString) < 30 {
			logger.Warn("Invalid token format - too short", "token_length", len(tokenString))
			http.Error(w, "Invalid token format", http.StatusUnauthorized)
			return
		}

		// Настройки парсера для дополнительной безопасности
		parser := jwt.NewParser(jwt.WithValidMethods([]string{"HS256"}))

		token, err := parser.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Проверка алгоритма подписи
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})

		if err != nil {
			logger.Warn("Token parsing failed", "error", err.Error())
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		if !token.Valid {
			logger.Warn("Token validation failed")
			http.Error(w, "Token validation failed", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			logger.Error("Failed to parse token claims")
			http.Error(w, "Failed to parse token claims", http.StatusUnauthorized)
			return
		}

		// Извлечение и проверка JTI для быстрой проверки отзыва
		var jti string
		if jtiVal, ok := claims["jti"].(string); ok && jtiVal != "" {
			jti = jtiVal
		} else {
			logger.Warn("Missing or invalid JTI in token")
			http.Error(w, "Invalid token structure", http.StatusUnauthorized)
			return
		}

		// Оптимизированная проверка JTI - сначала быстрая проверка в памяти
		if IsJTIRevoked(r.Context(), jti) {
			logger.Info("Token revoked", "jti", jti)
			http.Error(w, "Token revoked", http.StatusUnauthorized)
			return
		}

		// Проверка на истечение времени токена (exp)
		if exp, ok := claims["exp"].(float64); ok {
			expTime := time.Unix(int64(exp), 0)
			if time.Now().After(expTime) {
				logger.Info("Token expired", "jti", jti, "exp", expTime)
				http.Error(w, "Token has expired", http.StatusUnauthorized)
				return
			}
		} else {
			logger.Warn("Missing expiration time in token", "jti", jti)
			http.Error(w, "Invalid expiration time in token", http.StatusUnauthorized)
			return
		}

		// Проверка, что токен не из будущего
		if iat, ok := claims["iat"].(float64); ok {
			issuedAt := time.Unix(int64(iat), 0)
			if issuedAt.After(time.Now().Add(5 * time.Minute)) {
				logger.Warn("Token issued in future", "jti", jti, "iat", issuedAt)
				http.Error(w, "Token issued in the future", http.StatusUnauthorized)
				return
			}
		}

		// Извлечение ID пользователя
		userID, ok := claims["id"].(float64)
		if !ok {
			logger.Warn("Invalid user ID in token", "jti", jti)
			http.Error(w, "Invalid user ID in token", http.StatusUnauthorized)
			return
		}

		// Извлечение роли (допускаем строковое значение)
		roleValue, _ := claims["role"].(string)
		if roleValue != "" {
			if roleValue != string(models.RoleUser) && roleValue != string(models.RoleManager) {
				logger.Warn("Invalid user role in token", "jti", jti, "role", roleValue)
				http.Error(w, "Invalid user role value in token", http.StatusUnauthorized)
				return
			}
		}

		// Создаем контекст с данными из токена
		ctx := context.WithValue(r.Context(), UserIDKey, int(userID))
		if roleValue != "" {
			ctx = context.WithValue(ctx, RoleKey, roleValue)
		}
		ctx = context.WithValue(ctx, TokenIDKey, jti)
		if iat, ok := claims["iat"].(float64); ok {
			ctx = context.WithValue(ctx, TokenIssuedKey, time.Unix(int64(iat), 0))
		}

		// Логируем успешную аутентификацию
		logger.Info("Token validated successfully",
			"user_id", int(userID),
			"role", roleValue,
			"jti", jti,
		)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole возвращает middleware, которое разрешает доступ только указанным ролям (строкам).
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := r.Context().Value(RoleKey).(string)
			if !ok {
				http.Error(w, "User role not found", http.StatusForbidden)
				return
			}

			allowed := false
			for _, allowedRole := range allowedRoles {
				if role == allowedRole {
					allowed = true
					break
				}
			}

			if allowed {
				next.ServeHTTP(w, r)
			} else {
				http.Error(w, "Forbidden", http.StatusForbidden)
			}
		})
	}
}
