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
	"github.com/eeephemera/zvk-requests/models"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	// Загружаем переменные окружения
	if err := godotenv.Load(); err != nil {
		log.Fatal("Ошибка загрузки .env файла")
	}

	// Проверяем наличие необходимых переменных окружения
	requiredEnv := []string{
		"JWT_SECRET",
		"DB_HOST",
		"DB_PORT",
		"DB_USER",
		"DB_PASSWORD",
		"DB_NAME",
	}
	for _, envVar := range requiredEnv {
		if os.Getenv(envVar) == "" {
			log.Fatalf("Переменная окружения %s не установлена", envVar)
		}
	}

	// Устанавливаем секрет для JWT
	middleware.SetJWTSecret(os.Getenv("JWT_SECRET"))

	// Создаем контекст и подключаемся к базе
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := db.ConnectDB(ctx); err != nil {
		log.Fatalf("Ошибка подключения к базе данных: %v", err)
	}
	defer db.CloseDBConnection()

	pool := db.GetPool()
	if pool == nil {
		log.Fatal("Не удалось получить пул подключений к БД")
	}

	// Инициализируем обработчик заявок с репозиторием
	requestRepo := db.NewRequestRepository(pool)
	requestHandler := handlers.RequestHandler{Repo: requestRepo}

	// Создаем основной роутер
	r := mux.NewRouter()

	// CORS middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	// Публичные маршруты: регистрация и логин
	r.HandleFunc("/api/register", handlers.RegisterUser).Methods("POST")
	r.HandleFunc("/api/login", handlers.LoginUser).Methods("POST")

	// Защищенные маршруты: сначала проходит проверка JWT
	authRouter := r.PathPrefix("/api").Subrouter()
	authRouter.Use(middleware.ValidateToken)

	// --- Маршруты для пользователей (Пользователь) ---
	userRouter := authRouter.PathPrefix("/requests").Subrouter()
	userRouter.Use(middleware.RequireRole(string(models.RoleUser)))
	userRouter.HandleFunc("", requestHandler.CreateRequestHandler).Methods("POST")
	userRouter.HandleFunc("", requestHandler.GetRequestsByUserHandler).Methods("GET")
	userRouter.HandleFunc("", requestHandler.UpdateRequestHandler).Methods("PUT")
	userRouter.HandleFunc("/{id}", requestHandler.DeleteRequestHandler).Methods("DELETE")

	// --- Маршруты для менеджеров (Менеджер) ---
	managerRouter := authRouter.PathPrefix("/manager/requests").Subrouter()
	managerRouter.Use(middleware.RequireRole(string(models.RoleManager)))

	// Менеджер может получать все заявки
	managerRouter.HandleFunc("", requestHandler.GetAllRequestsHandler).Methods("GET")

	// Менеджер может обновлять заявки (не проверяя владельца)
	managerRouter.HandleFunc("/{id}", requestHandler.UpdateRequestByManagerHandler).Methods("PUT")

	// Менеджер может удалять заявки (не проверяя владельца)
	managerRouter.HandleFunc("/{id}", requestHandler.DeleteRequestByManagerHandler).Methods("DELETE")

	// Создаем HTTP сервер
	server := &http.Server{
		Addr:    ":8081",
		Handler: r,
	}

	// Обработка graceful shutdown
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt)

	go func() {
		log.Printf("Сервер запущен на %s\n", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Ошибка сервера: %v", err)
		}
	}()

	<-stopChan
	log.Println("Остановка сервера...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Ошибка при завершении работы: %v\n", err)
	}

	log.Println("Сервер успешно остановлен")
}
