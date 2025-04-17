// middleware/auth.go (пример)
package middleware

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/eeephemera/zvk-requests/models"
	"github.com/golang-jwt/jwt/v5"
)

// Ключи контекста
type contextKey string

const (
	UserIDKey contextKey = "userID"
	RoleKey   contextKey = "role"
)

// Глобальная переменная для хранения секрета
var jwtSecret []byte

// Установить секретный ключ (вызывается из main.go)
func SetJWTSecret(secret string) {
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
			// Keep log for missing cookie if desired, or remove
			// log.Println("ValidateToken: no cookie found:", err)
			http.Error(w, "Authorization cookie is missing", http.StatusUnauthorized)
			return
		}

		tokenString := cookie.Value
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			log.Printf("ValidateToken: token invalid: %v", err) // Keep log for invalid token
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			log.Println("ValidateToken: failed to parse claims") // Keep log for parsing failure
			http.Error(w, "Failed to parse token claims", http.StatusUnauthorized)
			return
		}

		userID, ok := claims["id"].(float64)
		if !ok {
			// Keep log for invalid ID type if desired
			// log.Println("ValidateToken: invalid id type in claims")
			http.Error(w, "Invalid user ID in token", http.StatusUnauthorized)
			return
		}

		roleValue, ok := claims["role"].(string)
		if !ok {
			// Keep log for invalid role type if desired
			// log.Println("ValidateToken: invalid role type in claims (expected string)")
			http.Error(w, "Invalid user role format in token", http.StatusUnauthorized)
			return
		}

		if roleValue != string(models.RoleUser) && roleValue != string(models.RoleManager) {
			// Keep log for unknown role value
			// log.Println("ValidateToken: unknown role string:", roleValue)
			http.Error(w, "Invalid user role value in token", http.StatusUnauthorized)
			return
		}

		// console.log(`ValidateToken: token OK: userID=%d, role=%s`, userID, roleValue) // Removed log
		ctx := context.WithValue(r.Context(), UserIDKey, int(userID))
		ctx = context.WithValue(ctx, RoleKey, roleValue)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole возвращает middleware, которое разрешает доступ только указанным ролям (строкам).
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := r.Context().Value(RoleKey).(string)
			if !ok {
				// Keep log for missing role in context if desired
				// log.Println("RequireRole: role not found in context or not a string")
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
				// Keep log for forbidden access if desired
				// log.Printf("RequireRole: Forbidden access for role '%s'. Allowed: %v", role, allowedRoles)
				http.Error(w, "Forbidden", http.StatusForbidden)
			}
		})
	}
}
