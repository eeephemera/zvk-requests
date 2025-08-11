package requests

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"

	"github.com/eeephemera/zvk-requests/server/db"
	"github.com/eeephemera/zvk-requests/server/handlers"
	"github.com/eeephemera/zvk-requests/server/middleware"
	"github.com/eeephemera/zvk-requests/server/models"
	"github.com/gorilla/mux"
)

// DownloadFileHandler обрабатывает запрос на скачивание файла.
// Проверяет, имеет ли пользователь (любой авторизованный) доступ к файлу,
// но не проверяет, привязан ли этот файл к конкретной заявке пользователя.
// Для более строгой проверки можно добавить логику проверки доступа к заявке.
func (h *RequestHandler) DownloadFileHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Получаем ID пользователя и его роль из контекста
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}
	userRole, _ := r.Context().Value(middleware.RoleKey).(models.UserRole)

	// 2. Получаем ID файла из URL
	vars := mux.Vars(r)
	fileIDStr, ok := vars["fileID"]
	if !ok {
		handlers.RespondWithError(w, http.StatusBadRequest, "File ID is missing")
		return
	}
	fileID, err := strconv.Atoi(fileIDStr)
	if err != nil {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid File ID format")
		return
	}

	// 3. Проверка прав доступа
	var hasAccess bool
	var errAccess error

	if userRole == models.RoleManager {
		// Менеджеру можно скачивать любой файл, но в идеале нужно проверять доступ к заявке
		// Для простоты пока дадим доступ ко всем файлам.
		// В проде можно добавить h.Repo.CheckManagerAccessToFile(r.Context(), userID, fileID)
		hasAccess = true
	} else {
		// Обычный пользователь должен быть автором заявки
		hasAccess, errAccess = h.Repo.CheckUserAccessToFile(r.Context(), userID, fileID)
	}

	if errAccess != nil {
		log.Printf("DownloadFileHandler: Error checking access for user %d, file %d: %v", userID, fileID, errAccess)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to check file access rights")
		return
	}
	if !hasAccess {
		handlers.RespondWithError(w, http.StatusForbidden, "You do not have permission to download this file")
		return
	}

	// 4. Получаем метаданные файла, чтобы узнать его имя и MIME-тип
	fileInfo, err := h.Repo.GetFileByID(r.Context(), fileID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusNotFound, "File not found")
			return
		}
		log.Printf("DownloadFileHandler: Error getting file info for ID %d: %v", fileID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to retrieve file information")
		return
	}

	// 5. Получаем содержимое файла
	fileData, err := h.Repo.GetFileDataByID(r.Context(), fileID)
	if err != nil {
		if errors.Is(err, db.ErrNotFound) {
			handlers.RespondWithError(w, http.StatusNotFound, "File data not found") // Маловероятно, если инфо есть
			return
		}
		log.Printf("DownloadFileHandler: Error getting file data for ID %d: %v", fileID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to retrieve file data")
		return
	}

	// 6. Отправляем файл пользователю
	// Устанавливаем заголовки для скачивания с корректной обработкой не-ASCII символов
	w.Header().Set("Content-Type", fileInfo.MimeType)
	// Формируем заголовок Content-Disposition, который понимают современные браузеры
	// filename* - это стандарт RFC 5987 для кодирования не-ASCII символов
	disposition := fmt.Sprintf("attachment; filename*=UTF-8''%s", url.QueryEscape(fileInfo.FileName))
	w.Header().Set("Content-Disposition", disposition)
	w.Header().Set("Content-Length", strconv.FormatInt(fileInfo.FileSize, 10))

	// Отправляем содержимое
	w.Write(fileData)
}

// ListRequestFilesForManager возвращает список файлов заявки для менеджера
func (h *RequestHandler) ListRequestFilesForManager(w http.ResponseWriter, r *http.Request) {
	managerID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "Manager not authenticated")
		return
	}
	vars := mux.Vars(r)
	requestIDStr := vars["id"]
	requestID, err := strconv.Atoi(requestIDStr)
	if err != nil || requestID <= 0 {
		handlers.RespondWithError(w, http.StatusBadRequest, "Invalid request ID format")
		return
	}
	// Проверка доступа менеджера к заявке
	hasAccess, err := h.Repo.CheckManagerAccess(r.Context(), managerID, requestID)
	if err != nil {
		log.Printf("ListRequestFilesForManager: Error checking manager access for manager %d, request %d: %v", managerID, requestID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to check access rights")
		return
	}
	if !hasAccess {
		handlers.RespondWithError(w, http.StatusForbidden, "Manager does not have permission to view files for this request")
		return
	}
	files, err := h.Repo.ListFilesForRequest(r.Context(), requestID)
	if err != nil {
		log.Printf("ListRequestFilesForManager: Error listing files for request %d: %v", requestID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to list files")
		return
	}
	handlers.RespondWithJSON(w, http.StatusOK, files)
}
