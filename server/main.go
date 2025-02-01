package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/eeephemera/zvk-requests/db"
	"github.com/eeephemera/zvk-requests/handlers"
	"github.com/eeephemera/zvk-requests/middleware"
	"github.com/gorilla/mux"
)

func main() {
	// Создаем контекст для всего приложения
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Инициализация соединения с базой данных
	db.ConnectDB(ctx)
	defer db.CloseDBConnection()

	// Получение пула соединений с БД
	pool := db.GetDBConnection()

	// Инициализация репозитория заявок
	requestRepo := db.NewRequestRepository(pool)
	requestHandler := handlers.RequestHandler{Repo: requestRepo}

	// Настройка маршрутов
	r := mux.NewRouter()

	// Маршруты для пользователей
	r.HandleFunc("/register", handlers.RegisterUser).Methods(http.MethodPost)
	r.HandleFunc("/login", handlers.LoginUser).Methods(http.MethodPost)

	// Маршруты для работы с заявками (с middleware проверки токена)
	r.Handle("/requests", middleware.ValidateToken(http.HandlerFunc(requestHandler.CreateRequestHandler))).Methods(http.MethodPost)
	r.Handle("/requests", middleware.ValidateToken(http.HandlerFunc(requestHandler.GetRequestsByUserHandler))).Methods(http.MethodGet)
	r.Handle("/requests", middleware.ValidateToken(http.HandlerFunc(requestHandler.UpdateRequestHandler))).Methods(http.MethodPut)
	r.Handle("/requests/{id}", middleware.ValidateToken(http.HandlerFunc(requestHandler.DeleteRequestHandler))).Methods(http.MethodDelete)

	// Тестовый маршрут для авторизованных пользователей
	r.Handle("/dashboard", middleware.ValidateToken(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Welcome to the dashboard"))
	}))).Methods(http.MethodGet)

	// Настройка HTTP-сервера
	server := &http.Server{
		Addr:    ":8080",
		Handler: r,
	}

	// Канал для обработки системных сигналов
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)

	// Запуск сервера в отдельной горутине
	go func() {
		log.Println("Server is running on http://localhost:8080")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Could not listen on %s: %v\n", server.Addr, err)
		}
	}()

	// Ожидание сигнала завершения
	<-stop
	log.Println("Shutting down server...")

	// Контекст для graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server shutdown failed: %v", err)
	}

	log.Println("Server exited gracefully")
}
