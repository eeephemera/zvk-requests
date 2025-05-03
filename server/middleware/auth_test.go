package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/eeephemera/zvk-requests/models"
	"github.com/golang-jwt/jwt/v5"
)

func TestSetAndGetJWTSecret(t *testing.T) {
	// Сохраняем исходный секрет для восстановления в конце теста
	originalSecret := jwtSecret
	defer func() {
		jwtSecret = originalSecret
	}()

	// Тестируем установку и получение секрета
	testSecret := "test-secret-key-1234567890"
	SetJWTSecret(testSecret)

	retrievedSecret := GetJWTSecret()
	if string(retrievedSecret) != testSecret {
		t.Errorf("GetJWTSecret() = %s, want %s", retrievedSecret, testSecret)
	}
}

func TestValidateToken(t *testing.T) {
	// Настройка тестового секрета
	testSecret := "test-secret-key-1234567890"
	SetJWTSecret(testSecret)

	// Создаем тестовый JWT токен
	validClaims := jwt.MapClaims{
		"id":   float64(123),
		"role": string(models.RoleUser),
		"jti":  "test-token-id",
		"iat":  float64(time.Now().Unix()),
		"exp":  float64(time.Now().Add(time.Hour).Unix()),
	}

	validToken := jwt.NewWithClaims(jwt.SigningMethodHS256, validClaims)
	tokenString, err := validToken.SignedString(jwtSecret)
	if err != nil {
		t.Fatalf("Failed to create test token: %v", err)
	}

	// Настройка HTTP запроса с cookie
	req := httptest.NewRequest("GET", "/api/protected", nil)
	req.AddCookie(&http.Cookie{
		Name:  "token",
		Value: tokenString,
	})

	// Обработчик для проверки контекста
	handlerCalled := false
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true

		// Проверка, что идентификатор пользователя добавлен в контекст
		userID, ok := r.Context().Value(UserIDKey).(int)
		if !ok || userID != 123 {
			t.Errorf("Context user ID = %v, want 123", userID)
		}

		// Проверка, что роль добавлена в контекст
		role, ok := r.Context().Value(RoleKey).(string)
		if !ok || role != string(models.RoleUser) {
			t.Errorf("Context role = %v, want %s", role, models.RoleUser)
		}

		// Проверка, что идентификатор токена добавлен в контекст
		tokenID, ok := r.Context().Value(TokenIDKey).(string)
		if !ok || tokenID != "test-token-id" {
			t.Errorf("Context token ID = %v, want test-token-id", tokenID)
		}

		w.WriteHeader(http.StatusOK)
	})

	// Применяем middleware
	handler := ValidateToken(testHandler)

	// Выполняем запрос
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// Проверяем, что обработчик был вызван и вернул 200 OK
	if !handlerCalled {
		t.Error("Handler was not called")
	}

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}
}

func TestValidateTokenWithExpiredToken(t *testing.T) {
	// Настройка тестового секрета
	testSecret := "test-secret-key-1234567890"
	SetJWTSecret(testSecret)

	// Создаем просроченный JWT токен
	expiredClaims := jwt.MapClaims{
		"id":   float64(123),
		"role": string(models.RoleUser),
		"jti":  "test-token-id",
		"iat":  float64(time.Now().Add(-2 * time.Hour).Unix()),
		"exp":  float64(time.Now().Add(-1 * time.Hour).Unix()), // Токен истек 1 час назад
	}

	expiredToken := jwt.NewWithClaims(jwt.SigningMethodHS256, expiredClaims)
	tokenString, err := expiredToken.SignedString(jwtSecret)
	if err != nil {
		t.Fatalf("Failed to create test token: %v", err)
	}

	// Настройка HTTP запроса с cookie
	req := httptest.NewRequest("GET", "/api/protected", nil)
	req.AddCookie(&http.Cookie{
		Name:  "token",
		Value: tokenString,
	})

	// Обработчик, который не должен быть вызван
	handlerCalled := false
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	})

	// Применяем middleware
	handler := ValidateToken(testHandler)

	// Выполняем запрос
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	// Проверяем, что обработчик не был вызван и вернулся статус 401
	if handlerCalled {
		t.Error("Handler was called with expired token")
	}

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("Handler returned wrong status code for expired token: got %v want %v", status, http.StatusUnauthorized)
	}
}

func TestValidateTokenWithInvalidToken(t *testing.T) {
	// Настройка тестового секрета
	testSecret := "test-secret-key-1234567890"
	SetJWTSecret(testSecret)

	// Тест с неверным форматом токена
	req := httptest.NewRequest("GET", "/api/protected", nil)
	req.AddCookie(&http.Cookie{
		Name:  "token",
		Value: "invalid-token-format",
	})

	handlerCalled := false
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	})

	handler := ValidateToken(testHandler)

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if handlerCalled {
		t.Error("Handler was called with invalid token")
	}

	if status := rr.Code; status != http.StatusUnauthorized {
		t.Errorf("Handler returned wrong status code for invalid token: got %v want %v", status, http.StatusUnauthorized)
	}
}

func TestRequireRole(t *testing.T) {
	// Тест, когда у пользователя есть необходимая роль
	testRoleUser(t, models.RoleUser, []string{string(models.RoleUser)}, http.StatusOK)

	// Тест, когда у пользователя нет необходимой роли
	testRoleUser(t, models.RoleUser, []string{string(models.RoleManager)}, http.StatusForbidden)

	// Тест с несколькими разрешенными ролями
	testRoleUser(t, models.RoleManager, []string{string(models.RoleUser), string(models.RoleManager)}, http.StatusOK)
}

func testRoleUser(t *testing.T, userRole models.UserRole, allowedRoles []string, expectedStatus int) {
	req := httptest.NewRequest("GET", "/api/protected", nil)
	ctx := context.WithValue(req.Context(), RoleKey, string(userRole))
	req = req.WithContext(ctx)

	handlerCalled := false
	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handlerCalled = true
		w.WriteHeader(http.StatusOK)
	})

	roleHandler := RequireRole(allowedRoles...)(testHandler)

	rr := httptest.NewRecorder()
	roleHandler.ServeHTTP(rr, req)

	// Если ожидается успешный статус, обработчик должен быть вызван
	shouldBeCalled := expectedStatus == http.StatusOK

	if handlerCalled != shouldBeCalled {
		t.Errorf("Handler called = %v, want %v", handlerCalled, shouldBeCalled)
	}

	if status := rr.Code; status != expectedStatus {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, expectedStatus)
	}
}
