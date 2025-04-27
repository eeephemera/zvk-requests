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
	"github.com/eeephemera/zvk-requests/handlers/requests"
	"github.com/eeephemera/zvk-requests/middleware"
	"github.com/eeephemera/zvk-requests/models"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	// Загружаем переменные окружения
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found or error loading it")
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

	// Инициализируем все репозитории
	userRepo := db.NewUserRepository(pool)
	partnerRepo := db.NewPartnerRepository(pool)
	endClientRepo := db.NewEndClientRepository(pool)
	productRepo := db.NewProductRepository(pool)
	requestRepo := db.NewRequestRepository(pool)

	// Инициализируем обработчики
	requestHandler := requests.NewRequestHandler(requestRepo, userRepo, partnerRepo, endClientRepo, productRepo)
	authHandler := &handlers.AuthHandler{
		UserRepo:    userRepo,
		PartnerRepo: partnerRepo,
	}
	partnerHandler := handlers.NewPartnerHandler(partnerRepo)
	productHandler := handlers.NewProductHandler(productRepo)
	endClientHandler := handlers.NewEndClientHandler(endClientRepo)

	// Создаем основной роутер
	r := mux.NewRouter()

	// CORS middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin == "http://localhost:3000" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Credentials", "true")
			}
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie")
			w.Header().Set("Access-Control-Expose-Headers", "Set-Cookie")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	// Публичные маршруты (используем функции из пакета handlers)
	r.HandleFunc("/api/register", handlers.RegisterUser).Methods("POST")
	r.HandleFunc("/api/login", handlers.LoginUser).Methods("POST")
	r.HandleFunc("/api/logout", handlers.LogoutUser).Methods("POST")

	// Защищенные маршруты
	authRouter := r.PathPrefix("/api").Subrouter()
	authRouter.Use(middleware.ValidateToken)

	authRouter.HandleFunc("/me", authHandler.Me).Methods("GET", "OPTIONS")
	authRouter.HandleFunc("/refresh", handlers.RefreshToken).Methods("POST", "OPTIONS")

	// --- Новые маршруты для справочников ---
	authRouter.HandleFunc("/partners", partnerHandler.ListPartnersHandler).Methods("GET", "OPTIONS")
	authRouter.HandleFunc("/products", productHandler.ListProductsHandler).Methods("GET", "OPTIONS")
	authRouter.HandleFunc("/end-clients/search", endClientHandler.SearchByINNHandler).Methods("GET", "OPTIONS")

	// --- Маршруты для пользователей (USER) ---
	userReqRouter := authRouter.PathPrefix("/requests").Subrouter()
	userReqRouter.Use(middleware.RequireRole(string(models.RoleUser)))
	userReqRouter.HandleFunc("", requestHandler.CreateRequestHandlerNew).Methods("POST")
	userReqRouter.HandleFunc("/my", requestHandler.ListMyRequestsHandler).Methods("GET")
	userReqRouter.HandleFunc("/my/{id:[0-9]+}", requestHandler.GetMyRequestDetailsHandler).Methods("GET")
	userReqRouter.HandleFunc("/download/{id:[0-9]+}", requestHandler.DownloadRequestHandler).Methods("GET")

	// --- Маршруты для менеджеров (MANAGER) ---
	managerReqRouter := authRouter.PathPrefix("/manager/requests").Subrouter()
	managerReqRouter.Use(middleware.RequireRole(string(models.RoleManager)))
	managerReqRouter.HandleFunc("", requestHandler.ListManagerRequestsHandler).Methods("GET")
	managerReqRouter.HandleFunc("/{id:[0-9]+}", requestHandler.GetManagerRequestDetailsHandler).Methods("GET")
	managerReqRouter.HandleFunc("/{id:[0-9]+}/status", requestHandler.UpdateRequestStatusHandler).Methods("PUT")
	managerReqRouter.HandleFunc("/{id:[0-9]+}", requestHandler.DeleteManagerRequestHandler).Methods("DELETE")

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
