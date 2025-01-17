package main

import (
	"net/http"

	"github.com/eeephemera/zvk-requests/handlers"
	"github.com/eeephemera/zvk-requests/middleware"
)

func main() {
	http.HandleFunc("/register", handlers.RegisterUser)
	http.HandleFunc("/login", handlers.LoginUser)

	// Пример защищенного маршрута
	http.Handle("/dashboard", middleware.ValidateToken(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Welcome to the dashboard"))
	})))

	http.ListenAndServe(":8080", nil)
}
