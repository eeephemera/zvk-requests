// middleware/auth.go (пример)
package middleware

import (
	"context"
	"fmt"
	"log"
	"net/http"

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
			log.Println("ValidateToken: no cookie found:", err)
			http.Error(w, "Authorization cookie is missing", http.StatusUnauthorized)
			return
		}
		log.Println("ValidateToken: received token:", cookie.Value)
		// Далее – разбор и проверка JWT...
		tokenString := cookie.Value
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return jwtSecret, nil
		})
		if err != nil || !token.Valid {
			log.Printf("ValidateToken: token invalid: %v", err)
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}
		// Если все OK, выводим информацию о пользователе:
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			log.Println("ValidateToken: failed to parse claims")
			http.Error(w, "Failed to parse token claims", http.StatusUnauthorized)
			return
		}
		idValue, ok := claims["id"].(float64)
		if !ok {
			log.Println("ValidateToken: invalid id in claims")
			http.Error(w, "Invalid user ID in token", http.StatusUnauthorized)
			return
		}
		role, ok := claims["role"].(string)
		if !ok {
			log.Println("ValidateToken: invalid role in claims")
			http.Error(w, "Invalid user role in token", http.StatusUnauthorized)
			return
		}
		log.Printf("ValidateToken: token OK: userID=%d, role=%s", int(idValue), role)
		ctx := context.WithValue(r.Context(), UserIDKey, int(idValue))
		ctx = context.WithValue(ctx, RoleKey, role)
		next.ServeHTTP(w, r.WithContext(ctx))
		log.Println("Request Headers:", r.Header)
	})
}

// RequireRole возвращает middleware, которое разрешает доступ только указанным ролям.
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Извлекаем роль пользователя из контекста
			role, ok := r.Context().Value(RoleKey).(string)
			if !ok {
				http.Error(w, "User role not found", http.StatusForbidden)
				return
			}
			// Проверяем, входит ли роль пользователя в список разрешённых
			for _, allowed := range allowedRoles {
				if role == allowed {
					next.ServeHTTP(w, r)
					return
				}
			}
			// Если роль не подходит – возвращаем ошибку доступа
			http.Error(w, "Forbidden", http.StatusForbidden)
		})
	}
}
