package utils

import (
	"log"

	"golang.org/x/crypto/bcrypt"
)

// HashPassword хэширует пароль с использованием bcrypt.
func HashPassword(password string) (string, error) {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Println("Error hashing password:", err)
		return "", err
	}
	return string(hashedPassword), nil
}

// CheckPasswordHash проверяет, совпадает ли введенный пароль с хэшированным.
func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	if err != nil {
		log.Printf("Error comparing password: %v\n", err)
		log.Printf("Password: %s\n", password)
		log.Printf("Hash: %s\n", hash)
	}
	return err == nil
}
