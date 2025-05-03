package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRateLimiterCleanup(t *testing.T) {
	// Создаем лимитер с маленьким окном (100 миллисекунд)
	rl := NewRateLimiter(100*time.Millisecond, 5)

	// Добавляем тестовые запросы
	rl.addRequest("test-ip", rl.ipRequests)
	rl.addRequest("test-ip:test-path", rl.pathRequests)

	// Проверяем, что запросы были добавлены
	if len(rl.ipRequests["test-ip"]) != 1 {
		t.Errorf("Expected 1 request for test-ip, got %d", len(rl.ipRequests["test-ip"]))
	}

	// Ждем, пока окно не истечет
	time.Sleep(200 * time.Millisecond)

	// Вызываем очистку
	rl.cleanup()

	// Проверяем, что записи были очищены
	if len(rl.ipRequests["test-ip"]) != 0 {
		t.Errorf("Expected 0 requests after cleanup, got %d", len(rl.ipRequests["test-ip"]))
	}

	// Или ключ был полностью удален
	if _, exists := rl.ipRequests["test-ip"]; exists {
		t.Errorf("Expected key to be removed from ipRequests")
	}
}

func TestRateLimiterLimitByIP(t *testing.T) {
	// Создаем лимитер с 2 запросами в течение 1 секунды
	rl := NewRateLimiter(1*time.Second, 2)

	// Создаем тестовый обработчик, который просто отвечает кодом 200
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Создаем тестовый сервер с middleware
	limitedHandler := rl.LimitByIP(handler)

	// Создаем тестовый запрос
	req, err := http.NewRequest("GET", "/", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.RemoteAddr = "192.168.1.1:1234" // Устанавливаем IP адрес

	// Первый запрос должен пройти
	rr := httptest.NewRecorder()
	limitedHandler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("First request: handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Второй запрос должен пройти
	rr = httptest.NewRecorder()
	limitedHandler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Second request: handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Третий запрос должен быть ограничен
	rr = httptest.NewRecorder()
	limitedHandler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusTooManyRequests {
		t.Errorf("Third request: expected %v for rate limited request, got %v", http.StatusTooManyRequests, status)
	}
}

func TestRateLimiterLimitByPath(t *testing.T) {
	// Создаем лимитер с 2 запросами в течение 1 секунды
	rl := NewRateLimiter(1*time.Second, 5)

	// Создаем тестовый обработчик, который просто отвечает кодом 200
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Создаем middleware для ограничения запросов к /api/login
	stricterLimit := 1 // Только 1 запрос разрешен
	limitedHandler := rl.LimitByPath([]string{"/api/login"}, stricterLimit)(handler)

	// Тест для пути /api/login (ограниченный)
	loginReq, err := http.NewRequest("GET", "/api/login", nil)
	if err != nil {
		t.Fatal(err)
	}
	loginReq.RemoteAddr = "192.168.1.1:1234"

	// Первый запрос к /api/login должен пройти
	rr := httptest.NewRecorder()
	limitedHandler.ServeHTTP(rr, loginReq)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("First login request: handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	// Второй запрос к /api/login должен быть ограничен
	rr = httptest.NewRecorder()
	limitedHandler.ServeHTTP(rr, loginReq)

	if status := rr.Code; status != http.StatusTooManyRequests {
		t.Errorf("Second login request: expected %v for rate limited request, got %v", http.StatusTooManyRequests, status)
	}

	// Тест для другого пути (неограниченный)
	otherReq, err := http.NewRequest("GET", "/api/other", nil)
	if err != nil {
		t.Fatal(err)
	}
	otherReq.RemoteAddr = "192.168.1.1:1234" // тот же IP

	// Запрос к другому пути должен пройти без ограничений
	rr = httptest.NewRecorder()
	limitedHandler.ServeHTTP(rr, otherReq)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Other path request: handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}
}
