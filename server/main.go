package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"time"

	"github.com/eeephemera/zvk-requests/server/db"
	"github.com/eeephemera/zvk-requests/server/handlers"
	requests_handler "github.com/eeephemera/zvk-requests/server/handlers/requests"
	"github.com/eeephemera/zvk-requests/server/middleware"
	"github.com/eeephemera/zvk-requests/server/models"
	"github.com/eeephemera/zvk-requests/server/utils"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	// Инициализируем структурированное логирование
	initLogging()

	// В dev-режиме можно подгружать локальный .env (без запекания в образ)
	if os.Getenv("APP_ENV") != "production" {
		_ = godotenv.Load() // опционально: .env в рабочей директории
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

	slog.Info("Подключение к базе данных...")
	if err := db.ConnectDB(ctx); err != nil {
		slog.Error("Ошибка подключения к базе данных", "error", err)
		log.Fatalf("Ошибка подключения к базе данных: %v", err)
	}
	defer db.CloseDBConnection()
	slog.Info("Подключение к базе данных установлено")

	pool := db.GetPool()
	if pool == nil {
		slog.Error("Не удалось получить пул подключений к БД")
		log.Fatal("Не удалось получить пул подключений к БД")
	}

	// Инициализируем все репозитории
	slog.Info("Инициализация репозиториев...")
	userRepo := db.NewUserRepository(pool)
	partnerRepo := db.NewPartnerRepository(pool)
	endClientRepo := db.NewEndClientRepository(pool)
	requestRepo := db.NewRequestRepository(pool)
	slog.Info("Репозитории инициализированы")

	// Инициализируем обработчики
	slog.Info("Инициализация обработчиков...")
	requestHandler := requests_handler.NewRequestHandler(requestRepo, userRepo, partnerRepo, endClientRepo)
	authHandler := handlers.NewAuthHandler(userRepo, partnerRepo)
	partnerHandler := handlers.NewPartnerHandler(partnerRepo)
	endClientHandler := handlers.NewEndClientHandler(endClientRepo)
	slog.Info("Обработчики инициализированы")

	// Создаем основной роутер
	r := mux.NewRouter()

	// Настраиваем персистентное хранилище отзывов токенов (через БД)
	middleware.SetRevocationStore(db.RevocationStoreDB{})

	// Health check endpoint
	r.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}).Methods("GET", "OPTIONS")

	// Инициализируем RateLimiter (читаем значения из ENV)
	window := 1 * time.Minute
	if v := os.Getenv("RATE_LIMIT_WINDOW_SECONDS"); v != "" {
		if sec, err := strconv.Atoi(v); err == nil && sec > 0 {
			window = time.Duration(sec) * time.Second
		}
	}
	maxReq := 300 // дефолт чуть выше, чтобы не мешал ручным тестам
	if v := os.Getenv("RATE_LIMIT_MAX_REQUESTS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			maxReq = n
		}
	}
	rateLimiter := middleware.NewRateLimiterWithBlock(window, maxReq, 15*time.Minute)

	// Базовый rate limiter для всех запросов
	r.Use(func(next http.Handler) http.Handler {
		return rateLimiter.LimitByIP(next)
	})

	// Специальный rate limiter для авторизации (более строгий: по умолчанию 20/мин)
	loginMax := 20
	if v := os.Getenv("RATE_LIMIT_LOGIN_PER_MIN"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			loginMax = n
		}
	}
	loginLimiter := middleware.NewRateLimiterWithBlock(1*time.Minute, loginMax, 30*time.Minute)

	// CORS middleware (УДАЛЕНО, теперь обрабатывается Nginx)
	// r.Use(func(next http.Handler) http.Handler {
	// 	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	// 		// Получаем список разрешенных доменов из переменной окружения
	// 		allowedOrigins := strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",")

	// 		origin := r.Header.Get("Origin")

	// 		// Проверяем, входит ли origin в список разрешенных
	// 		allowed := false
	// 		for _, allowedOrigin := range allowedOrigins {
	// 			if origin == strings.TrimSpace(allowedOrigin) {
	// 				allowed = true
	// 				break
	// 			}
	// 		}

	// 		if allowed {
	// 			w.Header().Set("Access-Control-Allow-Origin", origin)
	// 			w.Header().Set("Access-Control-Allow-Credentials", "true")
	// 		}

	// 		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS")
	// 		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie")
	// 		w.Header().Set("Access-Control-Expose-Headers", "Set-Cookie")

	// 		if r.Method == "OPTIONS" {
	// 			w.WriteHeader(http.StatusOK)
	// 			return
	// 		}
	// 		next.ServeHTTP(w, r)
	// 	})
	// })

	// Публичные маршруты
	r.HandleFunc("/api/register", authHandler.RegisterUser).Methods("POST")

	// Применяем более строгий rate limiter к маршруту login
	loginRouter := r.PathPrefix("/api/login").Subrouter()
	loginRouter.Use(loginLimiter.LimitByPath([]string{"/api/login"}, loginMax))
	loginRouter.HandleFunc("", authHandler.LoginUser).Methods("POST")

	// Отдельный лимит для чувствительных GET, например /api/end-clients/search
	sensitiveGetLimiter := middleware.NewRateLimiterWithBlock(1*time.Minute, 120, 10*time.Minute)
	r.PathPrefix("/api/end-clients/search").Handler(sensitiveGetLimiter.LimitByIP(http.HandlerFunc(endClientHandler.SearchByINNHandler))).Methods("GET", "OPTIONS")

	r.HandleFunc("/api/logout", handlers.LogoutUser).Methods("POST")

	// Защищенные маршруты
	authRouter := r.PathPrefix("/api").Subrouter()
	authRouter.Use(middleware.ValidateToken)
	// CSRF защита для всех мутирующих методов под /api
	authRouter.Use(utils.CSRFProtection)

	authRouter.HandleFunc("/me", authHandler.Me).Methods("GET", "OPTIONS")
	authRouter.HandleFunc("/refresh", handlers.RefreshToken).Methods("POST", "OPTIONS")

	// --- Новые маршруты для справочников ---
	authRouter.HandleFunc("/partners", partnerHandler.ListPartnersHandler).Methods("GET", "OPTIONS")
	authRouter.HandleFunc("/end-clients/search", endClientHandler.SearchByINNHandler).Methods("GET", "OPTIONS")

	// --- Маршруты для партнеров (USER) ---
	userRouter := authRouter.PathPrefix("/requests").Subrouter()
	userRouter.Use(middleware.RequireRole(string(models.RoleUser)))
	// Валидация для создания заявки (middleware)
	userRouter.Use(middleware.ValidateRequest(middleware.ValidateCreateRequest))
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
	// Маршрут скачивания файлов менеджером по fileID
	managerRouter.HandleFunc("/files/{fileID:[0-9]+}", requestHandler.DownloadFileHandler).Methods("GET")
	// Список файлов заявки для менеджера
	managerRouter.HandleFunc("/{id:[0-9]+}/files", requestHandler.ListRequestFilesForManager).Methods("GET")
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
		slog.Info("Запуск сервера", "address", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Ошибка сервера", "error", err)
			log.Fatalf("Ошибка сервера: %v", err)
		}
	}()

	<-stopChan
	slog.Info("Получен сигнал остановки, начинаем graceful shutdown...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("Ошибка при завершении работы сервера", "error", err)
		log.Printf("Ошибка при завершении работы: %v\n", err)
	}

	slog.Info("Сервер успешно остановлен")
}

// getServerPort возвращает порт сервера из переменной окружения или значение по умолчанию
func getServerPort() string {
	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8081" // Значение по умолчанию
	}
	return port
}

// initLogging инициализирует структурированное логирование
func initLogging() {
	logLevel := slog.LevelInfo
	if os.Getenv("APP_ENV") == "development" {
		logLevel = slog.LevelDebug
	}

	opts := &slog.HandlerOptions{
		Level: logLevel,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if a.Key == slog.TimeKey {
				return slog.Attr{}
			}
			return a
		},
	}

	logger := slog.New(slog.NewTextHandler(os.Stdout, opts))
	slog.SetDefault(logger)

	slog.Info("Структурированное логирование инициализировано",
		"level", logLevel.String(),
		"env", os.Getenv("APP_ENV"),
	)
}
