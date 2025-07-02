package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/eeephemera/zvk-requests/server/middleware"
)

// Настройка окружения перед тестами
func setupAuthTestEnv() {
	// Устанавливаем переменную окружения для тестов
	os.Setenv("JWT_EXPIRATION", "1h")
	os.Setenv("APP_ENV", "development")

	// Устанавливаем тестовый секрет для JWT
	middleware.SetJWTSecret("test-jwt-secret-for-handlers")
}

func TestLoginUserHandler(t *testing.T) {
	setupAuthTestEnv()

	// Пропускаем полный тест, так как он требует подключения к реальной БД
	// В реальном тесте нужно было бы создать мок репозитория
	t.Skip("Skipping test because it requires a real database connection")

	// Пример как бы выглядел тест с моком (код закомментирован, потому что для него нужны моки):
	/*
		// Создаем тестовый запрос с учетными данными
		loginData := LoginRequest{
			Login:    "testuser",
			Password: "testpassword",
		}

		// Создаем тестовое тело запроса
		reqBody, err := json.Marshal(loginData)
		if err != nil {
			t.Fatalf("Failed to marshal login data: %v", err)
		}

		// Создаем тестовый HTTP запрос
		req := httptest.NewRequest("POST", "/api/login", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")

		// Создаем ResponseRecorder для записи ответа
		rr := httptest.NewRecorder()

		// Вызываем обработчик
		handler := http.HandlerFunc(LoginUser)
		handler.ServeHTTP(rr, req)

		// Проверяем статус ответа
		if status := rr.Code; status != http.StatusOK {
			t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
		}

		// Проверяем наличие куки с токеном
		cookies := rr.Result().Cookies()
		var tokenCookie *http.Cookie
		for _, cookie := range cookies {
			if cookie.Name == "token" {
				tokenCookie = cookie
				break
			}
		}

		if tokenCookie == nil {
			t.Error("Token cookie not set")
		} else {
			// Проверяем, что кука имеет правильные настройки
			if !tokenCookie.HttpOnly {
				t.Error("Token cookie should be HttpOnly")
			}
			if tokenCookie.Secure && os.Getenv("APP_ENV") != "production" {
				t.Error("Token cookie should not be Secure in development")
			}
			if tokenCookie.SameSite != http.SameSiteLaxMode {
				t.Errorf("Token cookie should have SameSiteLaxMode, got %v", tokenCookie.SameSite)
			}

			// Проверяем валидность токена
			token, err := jwt.Parse(tokenCookie.Value, func(token *jwt.Token) (interface{}, error) {
				return middleware.GetJWTSecret(), nil
			})
			if err != nil || !token.Valid {
				t.Errorf("Invalid token: %v", err)
			}

			// Проверяем содержимое токена
			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				t.Error("Failed to parse claims")
			} else {
				if claims["login"] != loginData.Login {
					t.Errorf("Token login claim = %v, want %v", claims["login"], loginData.Login)
				}
				if _, ok := claims["jti"].(string); !ok {
					t.Error("Token is missing jti claim")
				}
				if _, ok := claims["iat"].(float64); !ok {
					t.Error("Token is missing iat claim")
				}
				if _, ok := claims["exp"].(float64); !ok {
					t.Error("Token is missing exp claim")
				}
			}
		}

		// Проверяем тело ответа
		var responseBody LoginResponse
		if err := json.NewDecoder(rr.Body).Decode(&responseBody); err != nil {
			t.Errorf("Failed to decode response body: %v", err)
		}

		if responseBody.Message != "Login successful" {
			t.Errorf("Response message = %s, want 'Login successful'", responseBody.Message)
		}
		if responseBody.User == nil {
			t.Error("Response user should not be nil")
		} else if responseBody.User.Login != loginData.Login {
			t.Errorf("Response user login = %s, want %s", responseBody.User.Login, loginData.Login)
		}
	*/
}

func TestLogoutUser(t *testing.T) {
	setupAuthTestEnv()

	// Создаем тестовый HTTP запрос
	req := httptest.NewRequest("POST", "/api/logout", nil)

	// Создаем ResponseRecorder для записи ответа
	rr := httptest.NewRecorder()

	// Вызываем обработчик
	handler := http.HandlerFunc(LogoutUser)
	handler.ServeHTTP(rr, req)

	// Проверяем статус ответа
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Проверяем наличие куки для удаления токена
	cookies := rr.Result().Cookies()
	var tokenCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "token" {
			tokenCookie = cookie
			break
		}
	}

	if tokenCookie == nil {
		t.Error("Token cookie not set")
	} else {
		// Проверяем, что кука имеет настройки для удаления
		if tokenCookie.Value != "" {
			t.Errorf("Token cookie value should be empty, got %s", tokenCookie.Value)
		}
		if !tokenCookie.Expires.Before(time.Now()) {
			t.Error("Token cookie should have expiration time in the past")
		}
		if !tokenCookie.HttpOnly {
			t.Error("Token cookie should be HttpOnly")
		}
	}

	// Проверяем тело ответа
	var responseBody map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&responseBody); err != nil {
		t.Errorf("Failed to decode response body: %v", err)
	}

	if message, ok := responseBody["message"]; !ok || message != "Logged out successfully" {
		t.Errorf("Response message = %s, want 'Logged out successfully'", message)
	}
}

func TestSetTokenCookie(t *testing.T) {
	setupAuthTestEnv()

	// Создаем ResponseRecorder для проверки установки куки
	rr := httptest.NewRecorder()

	// Тестовый токен
	testToken := "test-jwt-token"

	// Проверяем функцию в режиме разработки
	os.Setenv("APP_ENV", "development")
	setTokenCookie(rr, testToken)

	cookies := rr.Result().Cookies()
	var tokenCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "token" {
			tokenCookie = cookie
			break
		}
	}

	if tokenCookie == nil {
		t.Error("Token cookie not set in development mode")
	} else {
		if tokenCookie.Value != testToken {
			t.Errorf("Token cookie value = %s, want %s", tokenCookie.Value, testToken)
		}
		// В режиме разработки Secure должен быть false
		if tokenCookie.Secure {
			t.Error("Token cookie should not be Secure in development mode")
		}
		if !tokenCookie.HttpOnly {
			t.Error("Token cookie should be HttpOnly")
		}
	}

	// Проверяем функцию в режиме продакшена
	rr = httptest.NewRecorder()
	os.Setenv("APP_ENV", "production")
	setTokenCookie(rr, testToken)

	cookies = rr.Result().Cookies()
	tokenCookie = nil
	for _, cookie := range cookies {
		if cookie.Name == "token" {
			tokenCookie = cookie
			break
		}
	}

	if tokenCookie == nil {
		t.Error("Token cookie not set in production mode")
	} else {
		if tokenCookie.Value != testToken {
			t.Errorf("Token cookie value = %s, want %s", tokenCookie.Value, testToken)
		}
		// В режиме продакшена Secure должен быть true
		if !tokenCookie.Secure {
			t.Error("Token cookie should be Secure in production mode")
		}
		if !tokenCookie.HttpOnly {
			t.Error("Token cookie should be HttpOnly")
		}
	}

	// Восстанавливаем начальное значение
	os.Setenv("APP_ENV", "development")
}
