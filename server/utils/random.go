// server/utils/random.go
package utils

import (
	"crypto/rand"
	"encoding/base64"
	"math/big"
)

// RandomInt возвращает случайное целое число от 0 до max (не включая)
func RandomInt(max int) int {
	// Проверка на случай max <= 0
	if max <= 0 {
		return 0
	}

	// Используем crypto/rand для большей безопасности
	n, err := rand.Int(rand.Reader, big.NewInt(int64(max)))
	if err != nil {
		// В случае ошибки возвращаем просто 0 или можно добавить более сложную логику
		return 0
	}
	return int(n.Int64())
}

// GenerateSecureRandomString генерирует криптографически безопасную случайную строку длиной length
func GenerateSecureRandomString(length int) string {
	// Проверка на неправильную длину
	if length <= 0 {
		return ""
	}

	// Определяем, сколько байт нам нужно для генерации строки нужной длины после Base64 кодирования
	// Base64 превращает 3 байта в 4 символа, поэтому нам нужно length * 3/4 байт
	b := make([]byte, (length*3)/4+1)
	_, err := rand.Read(b)
	if err != nil {
		// В случае ошибки возвращаем строку нулей
		return string(make([]byte, length))
	}

	// Используем base64.RawURLEncoding для получения URL-безопасной строки без символов заполнения
	encoded := base64.RawURLEncoding.EncodeToString(b)

	// Обрезаем строку до нужной длины
	if len(encoded) > length {
		return encoded[:length]
	}
	return encoded
}
