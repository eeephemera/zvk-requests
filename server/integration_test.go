package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/eeephemera/zvk-requests/middleware"
	"github.com/gorilla/mux"
)

func TestCORSMiddleware(t *testing.T) {
	// Сохраняем оригинальное значение переменной окружения
	origCORS := os.Getenv("CORS_ALLOWED_ORIGINS")
	defer os.Setenv("CORS_ALLOWED_ORIGINS", origCORS)

	// Устанавливаем тестовое значение
	os.Setenv("CORS_ALLOWED_ORIGINS", "https://example.com,https://api.example.com")

	// Создаем тестовый роутер
	r := mux.NewRouter()

	// Добавляем тестовый обработчик для OPTIONS запросов
	r.HandleFunc("/api/test", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Test OK"))
	}).Methods("GET", "OPTIONS")

	// Применяем CORS middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Получаем список разрешенных доменов из переменной окружения
			allowedOrigins := strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",")

			origin := r.Header.Get("Origin")

			// Проверяем, входит ли origin в список разрешенных
			allowed := false
			for _, allowedOrigin := range allowedOrigins {
				if origin == strings.TrimSpace(allowedOrigin) {
					allowed = true
					break
				}
			}

			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}

			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie")
			w.Header().Set("Access-Control-Expose-Headers", "Set-Cookie")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	// Тестируем запрос с разрешенным Origin
	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set("Origin", "https://example.com")
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	// Проверяем статус ответа
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Проверяем заголовки CORS
	if allowOrigin := rr.Header().Get("Access-Control-Allow-Origin"); allowOrigin != "https://example.com" {
		t.Errorf("Access-Control-Allow-Origin = %s, want %s", allowOrigin, "https://example.com")
	}
	if allowCreds := rr.Header().Get("Access-Control-Allow-Credentials"); allowCreds != "true" {
		t.Errorf("Access-Control-Allow-Credentials = %s, want %s", allowCreds, "true")
	}

	// Тестируем запрос с неразрешенным Origin
	req = httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set("Origin", "https://attacker.com")
	rr = httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	// Проверяем отсутствие заголовка Access-Control-Allow-Origin
	if allowOrigin := rr.Header().Get("Access-Control-Allow-Origin"); allowOrigin != "" {
		t.Errorf("Access-Control-Allow-Origin = %s, want empty string", allowOrigin)
	}
	if allowCreds := rr.Header().Get("Access-Control-Allow-Credentials"); allowCreds == "true" {
		t.Errorf("Access-Control-Allow-Credentials should not be set for unauthorized origins")
	}

	// Тестируем предварительный запрос (OPTIONS)
	req = httptest.NewRequest("OPTIONS", "/api/test", nil)
	req.Header.Set("Origin", "https://example.com")
	rr = httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	// Проверяем статус ответа
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Options request returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Проверяем заголовки CORS для OPTIONS
	if allowMethods := rr.Header().Get("Access-Control-Allow-Methods"); !strings.Contains(allowMethods, "POST") {
		t.Errorf("Access-Control-Allow-Methods should contain POST, got %s", allowMethods)
	}
	if allowHeaders := rr.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(allowHeaders, "Content-Type") {
		t.Errorf("Access-Control-Allow-Headers should contain Content-Type, got %s", allowHeaders)
	}
}

func TestRateLimiterIntegration(t *testing.T) {
	// Создаем тестовый роутер
	r := mux.NewRouter()

	// Применяем Rate Limiter middleware
	rateLimiter := middleware.NewRateLimiter(1000*time.Millisecond, 2) // 2 запроса в секунду
	r.Use(rateLimiter.LimitByIP)

	// Добавляем тестовый обработчик
	r.HandleFunc("/api/test", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Test OK"))
	}).Methods("GET")

	// Создаем тестовый запрос
	req := httptest.NewRequest("GET", "/api/test", nil)
	req.RemoteAddr = "192.168.1.1:1234"

	// Первые два запроса должны пройти
	for i := 0; i < 2; i++ {
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)

		if status := rr.Code; status != http.StatusOK {
			t.Errorf("Request %d returned wrong status code: got %v want %v", i+1, status, http.StatusOK)
		}
	}

	// Третий запрос должен быть ограничен
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusTooManyRequests {
		t.Errorf("Rate limit not applied: got %v want %v", status, http.StatusTooManyRequests)
	}
}
