// middleware/auth.go (пример)
package middleware

import (
	"context"
	"fmt"
	"log"
	"net/http"
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

// ValidateToken — middleware для проверки JWT, извлекаемого из куки
func ValidateToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("token")
		if err != nil {
			http.Error(w, "Authorization cookie is missing", http.StatusUnauthorized)
			return
		}

		tokenString := cookie.Value

		// Добавляем проверку на минимальную длину, чтобы отсечь очевидно неверные токены
		if len(tokenString) < 30 {
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
			log.Printf("ValidateToken: token invalid: %v", err)
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		if !token.Valid {
			http.Error(w, "Token validation failed", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			log.Println("ValidateToken: failed to parse claims")
			http.Error(w, "Failed to parse token claims", http.StatusUnauthorized)
			return
		}

		// Проверка на истечение времени токена (exp)
		if exp, ok := claims["exp"].(float64); ok {
			expTime := time.Unix(int64(exp), 0)
			if time.Now().After(expTime) {
				http.Error(w, "Token has expired", http.StatusUnauthorized)
				return
			}
		} else {
			http.Error(w, "Invalid expiration time in token", http.StatusUnauthorized)
			return
		}

		// Проверка, что токен не использовался раньше установленного времени (iat, если есть)
		if iat, ok := claims["iat"].(float64); ok {
			issuedAt := time.Unix(int64(iat), 0)
			// Проверка, что токен не из будущего (с погрешностью на разницу в часах серверов)
			if issuedAt.After(time.Now().Add(5 * time.Minute)) {
				http.Error(w, "Token issued in the future", http.StatusUnauthorized)
				return
			}
		}

		// Извлечение ID пользователя
		userID, ok := claims["id"].(float64)
		if !ok {
			http.Error(w, "Invalid user ID in token", http.StatusUnauthorized)
			return
		}

		// Извлечение роли
		roleValue, ok := claims["role"].(string)
		if !ok {
			http.Error(w, "Invalid user role format in token", http.StatusUnauthorized)
			return
		}

		// Проверка, что роль имеет допустимое значение
		if roleValue != string(models.RoleUser) && roleValue != string(models.RoleManager) {
			http.Error(w, "Invalid user role value in token", http.StatusUnauthorized)
			return
		}

		// Извлечение JWT ID (jti) для возможного будущего blacklisting
		var tokenID string
		if jti, ok := claims["jti"].(string); ok {
			tokenID = jti
		}

		// Создаем контекст с данными из токена
		ctx := context.WithValue(r.Context(), UserIDKey, int(userID))
		ctx = context.WithValue(ctx, RoleKey, roleValue)

		// Добавляем дополнительные данные в контекст, если они есть в токене
		if tokenID != "" {
			ctx = context.WithValue(ctx, TokenIDKey, tokenID)
		}
		if iat, ok := claims["iat"].(float64); ok {
			ctx = context.WithValue(ctx, TokenIssuedKey, time.Unix(int64(iat), 0))
		}

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
