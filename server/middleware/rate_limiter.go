// server/middleware/rate_limiter.go
package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// RateLimiter предоставляет базовую защиту от DoS и брутфорс атак.
type RateLimiter struct {
	mu            sync.Mutex
	ipRequests    map[string][]time.Time
	pathRequests  map[string][]time.Time
	blockedIPs    map[string]time.Time // Временная блокировка IP
	windowSize    time.Duration
	maxRequests   int
	blockDuration time.Duration // Длительность блокировки
}

// NewRateLimiter создает новый экземпляр ограничителя запросов.
// windowSize - временное окно для подсчета запросов (например, 1 минута).
// maxRequests - максимальное количество запросов в окне.
// blockDuration - длительность блокировки IP при превышении лимита (по умолчанию 5 минут).
func NewRateLimiter(windowSize time.Duration, maxRequests int) *RateLimiter {
	return &RateLimiter{
		ipRequests:    make(map[string][]time.Time),
		pathRequests:  make(map[string][]time.Time),
		blockedIPs:    make(map[string]time.Time),
		windowSize:    windowSize,
		maxRequests:   maxRequests,
		blockDuration: 5 * time.Minute, // Блокировка на 5 минут по умолчанию
	}
}

// NewRateLimiterWithBlock создает RateLimiter с кастомной длительностью блокировки.
func NewRateLimiterWithBlock(windowSize time.Duration, maxRequests int, blockDuration time.Duration) *RateLimiter {
	return &RateLimiter{
		ipRequests:    make(map[string][]time.Time),
		pathRequests:  make(map[string][]time.Time),
		blockedIPs:    make(map[string]time.Time),
		windowSize:    windowSize,
		maxRequests:   maxRequests,
		blockDuration: blockDuration,
	}
}

// cleanup удаляет устаревшие записи о запросах и блокировках.
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

	// Очистка просроченных блокировок IP
	for ip, blockedUntil := range rl.blockedIPs {
		if now.After(blockedUntil) {
			delete(rl.blockedIPs, ip)
		}
	}
}

// isBlocked проверяет, заблокирован ли IP адрес.
func (rl *RateLimiter) isBlocked(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	blockedUntil, exists := rl.blockedIPs[ip]
	if !exists {
		return false
	}

	if time.Now().After(blockedUntil) {
		delete(rl.blockedIPs, ip)
		return false
	}

	return true
}

// blockIP блокирует IP адрес на указанное время.
func (rl *RateLimiter) blockIP(ip string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	rl.blockedIPs[ip] = time.Now().Add(rl.blockDuration)
}

// blockIPUnsafe блокирует IP без захвата mutex (вызывается когда mutex уже захвачен).
func (rl *RateLimiter) blockIPUnsafe(ip string) {
	rl.blockedIPs[ip] = time.Now().Add(rl.blockDuration)
}

// isLimited проверяет, превышен ли лимит запросов.
func (rl *RateLimiter) isLimited(key string, requests map[string][]time.Time) bool {
	// Очищаем старые запросы и блокировки
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
		// Получаем реальный IP пользователя (первый из X-Forwarded-For)
		ip := r.Header.Get("X-Forwarded-For")
		if ip != "" {
			// берём первый hop
			if comma := strings.Index(ip, ","); comma != -1 {
				ip = strings.TrimSpace(ip[:comma])
			} else {
				ip = strings.TrimSpace(ip)
			}
		}
		if ip == "" {
			ip = r.Header.Get("X-Real-IP")
		}
		if ip == "" {
			ip = r.RemoteAddr
		}

		// Проверяем, заблокирован ли IP
		if rl.isBlocked(ip) {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", fmt.Sprintf("%.0f", rl.blockDuration.Seconds()))
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"IP blocked due to rate limit exceeded"}`))
			return
		}

		rl.mu.Lock()

		// Проверяем лимит
		if rl.isLimited(ip, rl.ipRequests) {
			// Блокируем IP при превышении лимита
			rl.blockIPUnsafe(ip)
			rl.mu.Unlock()
			rl.respondTooManyRequests(w)
			return
		}

		// Регистрируем запрос
		rl.addRequest(ip, rl.ipRequests)
		rl.mu.Unlock()

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

			// Получаем IP
			ip := r.Header.Get("X-Real-IP")
			if ip == "" {
				ip = r.Header.Get("X-Forwarded-For")
				if ip == "" {
					ip = r.RemoteAddr
				}
			}

			// Проверяем, заблокирован ли IP
			if rl.isBlocked(ip) {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", fmt.Sprintf("%.0f", rl.blockDuration.Seconds()))
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"IP blocked due to rate limit exceeded"}`))
				return
			}

			rl.mu.Lock()

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
				// Блокируем IP при превышении лимита
				rl.blockIPUnsafe(ip)
				rl.mu.Unlock()
				rl.respondTooManyRequests(w)
				return
			}

			// Регистрируем запрос
			rl.addRequest(key, requests)
			rl.mu.Unlock()

			next.ServeHTTP(w, r)
		})
	}
}
