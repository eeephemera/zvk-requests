package utils

import (
	"errors"
	"fmt"
	"net/http"
	"unicode"

	"golang.org/x/crypto/bcrypt"
)

func HashPassword(password string) (string, error) {
	if err := ValidatePassword(password); err != nil {
		return "", fmt.Errorf("invalid password: %w", err)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}
	return string(hashedPassword), nil
}

func CheckPasswordHash(password, hash string) error {
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return fmt.Errorf("password verification failed: %w", err)
	}
	return nil
}

// NeedsRehash возвращает true, если текущий bcrypt-хеш имеет стоимость ниже рекомендуемой
// и его следует пересчитать при следующем входе пользователя.
func NeedsRehash(hash string) bool {
	cost, err := bcrypt.Cost([]byte(hash))
	if err != nil {
		return true
	}
	return cost < bcrypt.DefaultCost
}

func ValidatePassword(password string) error {
	if len(password) < 8 {
		return errors.New("пароль должен содержать не менее 8 символов")
	}

	hasNumber := false
	hasUpper := false
	hasSpecial := false

	for _, char := range password {
		switch {
		case unicode.IsDigit(char):
			hasNumber = true
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	if !hasNumber {
		return errors.New("пароль должен содержать хотя бы одну цифру")
	}
	if !hasUpper {
		return errors.New("пароль должен содержать хотя бы одну заглавную букву")
	}
	if !hasSpecial {
		return errors.New("пароль должен содержать хотя бы один специальный символ")
	}

	return nil
}

func CSRFProtection(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Пропускаем GET, HEAD, OPTIONS
		if r.Method == "GET" || r.Method == "HEAD" || r.Method == "OPTIONS" {
			next.ServeHTTP(w, r)
			return
		}

		// Проверяем CSRF-токен в заголовке
		csrfToken := r.Header.Get("X-CSRF-Token")
		if csrfToken == "" {
			http.Error(w, "Invalid CSRF token", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}
