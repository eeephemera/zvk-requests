// server/middleware/rate_limiter.go
package middleware

import (
	"fmt"
	"net/http"
	"sync"
	"time"
)

// RateLimiter предоставляет базовую защиту от DoS и брутфорс атак.
type RateLimiter struct {
	mu           sync.Mutex
	ipRequests   map[string][]time.Time
	pathRequests map[string][]time.Time
	windowSize   time.Duration
	maxRequests  int
}

// NewRateLimiter создает новый экземпляр ограничителя запросов.
// windowSize - временное окно для подсчета запросов (например, 1 минута).
// maxRequests - максимальное количество запросов в окне.
func NewRateLimiter(windowSize time.Duration, maxRequests int) *RateLimiter {
	return &RateLimiter{
		ipRequests:   make(map[string][]time.Time),
		pathRequests: make(map[string][]time.Time),
		windowSize:   windowSize,
		maxRequests:  maxRequests,
	}
}

// cleanup удаляет устаревшие записи о запросах.
func (rl *RateLimiter) cleanup() {
	now := time.Now()
	threshold := now.Add(-rl.windowSize)

	// Очистка по IP
	for ip, times := range rl.ipRequests {
		var validTimes []time.Time
		for _, t := range times {
			if t.After(threshold) {
				validTimes = append(validTimes, t)
			}
		}
		if len(validTimes) == 0 {
			delete(rl.ipRequests, ip)
		} else {
			rl.ipRequests[ip] = validTimes
		}
	}

	// Очистка по путям
	for path, times := range rl.pathRequests {
		var validTimes []time.Time
		for _, t := range times {
			if t.After(threshold) {
				validTimes = append(validTimes, t)
			}
		}
		if len(validTimes) == 0 {
			delete(rl.pathRequests, path)
		} else {
			rl.pathRequests[path] = validTimes
		}
	}
}

// isLimited проверяет, превышен ли лимит запросов.
func (rl *RateLimiter) isLimited(key string, requests map[string][]time.Time) bool {
	// Очищаем старые запросы
	rl.cleanup()

	// Если количество запросов превышает лимит, возвращаем true
	return len(requests[key]) >= rl.maxRequests
}

// addRequest регистрирует новый запрос.
func (rl *RateLimiter) addRequest(key string, requests map[string][]time.Time) {
	now := time.Now()
	requests[key] = append(requests[key], now)
}

// respondTooManyRequests отвечает в JSON формате с кодом 429.
func (rl *RateLimiter) respondTooManyRequests(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Retry-After", fmt.Sprintf("%.0f", rl.windowSize.Seconds()))
	w.WriteHeader(http.StatusTooManyRequests)
	_, _ = w.Write([]byte(`{"error":"Rate limit exceeded"}`))
}

// LimitByIP создает middleware для ограничения по IP адресу.
func (rl *RateLimiter) LimitByIP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rl.mu.Lock()
		defer rl.mu.Unlock()

		// Получаем реальный IP пользователя
		ip := r.Header.Get("X-Real-IP")
		if ip == "" {
			ip = r.Header.Get("X-Forwarded-For")
			if ip == "" {
				ip = r.RemoteAddr
			}
		}

		// Проверяем лимит
		if rl.isLimited(ip, rl.ipRequests) {
			rl.respondTooManyRequests(w)
			return
		}

		// Регистрируем запрос
		rl.addRequest(ip, rl.ipRequests)

		next.ServeHTTP(w, r)
	})
}

// LimitByPath создает middleware для ограничения по пути запроса.
// Полезно для особо чувствительных путей, как /api/login.
func (rl *RateLimiter) LimitByPath(paths []string, stricterLimit int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path

			// Проверяем только указанные пути
			isTargetPath := false
			for _, p := range paths {
				if path == p {
					isTargetPath = true
					break
				}
			}

			if !isTargetPath {
				next.ServeHTTP(w, r)
				return
			}

			rl.mu.Lock()
			defer rl.mu.Unlock()

			// Получаем IP
			ip := r.Header.Get("X-Real-IP")
			if ip == "" {
				ip = r.Header.Get("X-Forwarded-For")
				if ip == "" {
					ip = r.RemoteAddr
				}
			}

			// Создаем ключ ip:path для более точного отслеживания
			key := ip + ":" + path

			// Проверяем лимит
			// Для чувствительных путей используем более строгий лимит
			currentLimit := stricterLimit
			if currentLimit <= 0 {
				currentLimit = rl.maxRequests
			}

			requests := rl.pathRequests
			if len(requests[key]) >= currentLimit {
				rl.respondTooManyRequests(w)
				return
			}

			// Регистрируем запрос
			rl.addRequest(key, requests)

			next.ServeHTTP(w, r)
		})
	}
}
