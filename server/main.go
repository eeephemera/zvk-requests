package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/eeephemera/zvk-requests/server/db"
	"github.com/eeephemera/zvk-requests/server/handlers"
	requests_handler "github.com/eeephemera/zvk-requests/server/handlers/requests"
	"github.com/eeephemera/zvk-requests/server/middleware"
	"github.com/eeephemera/zvk-requests/server/models"

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
	requestRepo := db.NewRequestRepository(pool)

	// Инициализируем обработчики
	requestHandler := requests_handler.NewRequestHandler(requestRepo, userRepo, partnerRepo, endClientRepo)
	authHandler := handlers.NewAuthHandler(userRepo, partnerRepo)
	partnerHandler := handlers.NewPartnerHandler(partnerRepo)
	endClientHandler := handlers.NewEndClientHandler(endClientRepo)

	// Создаем основной роутер
	r := mux.NewRouter()

	// Инициализируем RateLimiter
	rateLimiter := middleware.NewRateLimiter(1*time.Minute, 100) // 100 запросов в минуту

	// CORS middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Получаем список разрешенных доменов из переменной окружения
			allowedOrigins := strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",")

			origin := r.Header.Get("Origin")

			// Проверяем, входит ли origin в список разрешенных
			allowed := false
			for _, allowedOrigin := range allowedOrigins {
				if origin == strings.TrimSpace(allowedOrigin) {
					allowed = true
					break
				}
			}

			if allowed {
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

	// Базовый rate limiter для всех запросов
	r.Use(rateLimiter.LimitByIP)

	// Специальный rate limiter для авторизации (более строгий: 10 запросов в минуту)
	loginLimiter := middleware.NewRateLimiter(1*time.Minute, 10)

	// Публичные маршруты
	r.HandleFunc("/api/register", authHandler.RegisterUser).Methods("POST")

	// Применяем более строгий rate limiter к маршруту login
	loginRouter := r.PathPrefix("/api/login").Subrouter()
	loginRouter.Use(loginLimiter.LimitByPath([]string{"/api/login"}, 10))
	loginRouter.HandleFunc("", authHandler.LoginUser).Methods("POST")

	r.HandleFunc("/api/logout", handlers.LogoutUser).Methods("POST")

	// Защищенные маршруты
	authRouter := r.PathPrefix("/api").Subrouter()
	authRouter.Use(middleware.ValidateToken)

	authRouter.HandleFunc("/me", authHandler.Me).Methods("GET", "OPTIONS")
	authRouter.HandleFunc("/refresh", handlers.RefreshToken).Methods("POST", "OPTIONS")

	// --- Новые маршруты для справочников ---
	authRouter.HandleFunc("/partners", partnerHandler.ListPartnersHandler).Methods("GET", "OPTIONS")
	authRouter.HandleFunc("/end-clients/search", endClientHandler.SearchByINNHandler).Methods("GET", "OPTIONS")

	// --- Маршруты для партнеров (USER) ---
	userRouter := authRouter.PathPrefix("/requests").Subrouter()
	userRouter.Use(middleware.RequireRole(string(models.RoleUser)))
	userRouter.HandleFunc("", requestHandler.CreateRequestHandlerNew).Methods("POST")
	userRouter.HandleFunc("/my", requestHandler.ListMyRequestsHandler).Methods("GET")
	userRouter.HandleFunc("/my/{id:[0-9]+}", requestHandler.GetMyRequestDetailsHandler).Methods("GET")
	// Новый роут для скачивания файла по его ID
	userRouter.HandleFunc("/files/{fileID:[0-9]+}", requestHandler.DownloadFileHandler).Methods("GET")

	// --- Маршруты для менеджеров (MANAGER) ---
	managerRouter := authRouter.PathPrefix("/manager/requests").Subrouter()
	managerRouter.Use(middleware.RequireRole(string(models.RoleManager)))
	// Сначала определяем более конкретные маршруты
	managerRouter.HandleFunc("/{id:[0-9]+}/status", requestHandler.UpdateRequestStatusHandler).Methods("PUT")
	// Затем общие
	managerRouter.HandleFunc("", requestHandler.ListManagerRequestsHandler).Methods("GET")
	managerRouter.HandleFunc("/{id:[0-9]+}", requestHandler.GetManagerRequestDetailsHandler).Methods("GET")
	managerRouter.HandleFunc("/{id:[0-9]+}", requestHandler.DeleteManagerRequestHandler).Methods("DELETE")

	// Создаем HTTP сервер
	server := &http.Server{
		Addr:    ":" + getServerPort(),
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

// getServerPort возвращает порт сервера из переменной окружения или значение по умолчанию
func getServerPort() string {
	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8081" // Значение по умолчанию
	}
	return port
}
