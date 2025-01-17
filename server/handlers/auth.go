package handlers

import (
	"encoding/json"
	"models"
	"net/http"
	"time"
	"zvk-requests/utils"

	"github.com/golang-jwt/jwt/v5"
)

var secretKey = []byte("qwerty123") // Замените на более безопасный ключ

// RegisterUser registers a new user.
func RegisterUser(w http.ResponseWriter, r *http.Request) {
	var user models.User
	err := json.NewDecoder(r.Body).Decode(&user)
	if err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	hashedPassword, err := utils.HashPassword(user.Password)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}
	user.Password = hashedPassword
	user.CreatedAt = time.Now()

	// Добавьте пользователя в базу данных (нужно будет реализовать это в следующем шаге)

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

// LoginUser authenticates a user and returns a JWT.
func LoginUser(w http.ResponseWriter, r *http.Request) {
	var loginData struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	err := json.NewDecoder(r.Body).Decode(&loginData)
	if err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Поиск пользователя в базе данных (псевдокод)
	var user models.User
	// Пример проверки пользователя в базе
	if user.Email != loginData.Email || !utils.CheckPasswordHash(loginData.Password, user.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Создание JWT токена
	claims := &jwt.RegisteredClaims{
		Issuer:    "zvk-requests",
		Subject:   string(user.ID),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(secretKey)
	if err != nil {
		http.Error(w, "Error creating token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Authorization", "Bearer "+signedToken)
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"token": signedToken})
}
