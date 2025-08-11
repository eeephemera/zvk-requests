package requests

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/eeephemera/zvk-requests/server/db"
	"github.com/eeephemera/zvk-requests/server/handlers"
	"github.com/eeephemera/zvk-requests/server/middleware"
	"github.com/eeephemera/zvk-requests/server/utils"
	"github.com/gorilla/mux"
)

// DownloadFileHandler обрабатывает запрос на скачивание файла.
// Выполняет строгую проверку доступа для всех ролей и поддерживает Range/ETag.
func (h *RequestHandler) DownloadFileHandler(w http.ResponseWriter, r *http.Request) {
	// 1. Получаем ID пользователя и его роль из контекста
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		handlers.RespondWithError(w, http.StatusUnauthorized, "User not authenticated")
		return
	}

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

	// 3. Строгая проверка прав доступа (включая менеджеров)
	hasAccess, errAccess := h.Repo.CheckUserAccessToFile(r.Context(), userID, fileID)
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
			handlers.RespondWithError(w, http.StatusNotFound, "File data not found")
			return
		}
		log.Printf("DownloadFileHandler: Error getting file data for ID %d: %v", fileID, err)
		handlers.RespondWithError(w, http.StatusInternalServerError, "Failed to retrieve file data")
		return
	}

	// 6. Заголовки кеширования/валидации
	etag := fmt.Sprintf("\"file-%d-%d-%d\"", fileInfo.ID, fileInfo.FileSize, fileInfo.CreatedAt.Unix())
	w.Header().Set("ETag", etag)
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	w.Header().Set("Accept-Ranges", "bytes")
	lastModified := fileInfo.CreatedAt.UTC().Format(http.TimeFormat)
	w.Header().Set("Last-Modified", lastModified)

	if inm := r.Header.Get("If-None-Match"); inm != "" && strings.Contains(inm, etag) {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	if ims := r.Header.Get("If-Modified-Since"); ims != "" {
		if t, err := time.Parse(http.TimeFormat, ims); err == nil {
			if !fileInfo.CreatedAt.After(t) {
				w.WriteHeader(http.StatusNotModified)
				return
			}
		}
	}

	// 7. Контент и имя файла (санитизированное)
	cleanName := utils.SanitizeFilename(fileInfo.FileName)
	w.Header().Set("Content-Type", fileInfo.MimeType)
	disposition := fmt.Sprintf("attachment; filename*=UTF-8''%s", url.QueryEscape(cleanName))
	w.Header().Set("Content-Disposition", disposition)

	// 8. Поддержка Range-запросов
	rangeHeader := r.Header.Get("Range")
	total := int64(len(fileData))
	if rangeHeader == "" {
		w.Header().Set("Content-Length", strconv.FormatInt(total, 10))
		w.WriteHeader(http.StatusOK)
		w.Write(fileData)
		return
	}

	// Пример Range: bytes=start-end
	if !strings.HasPrefix(rangeHeader, "bytes=") {
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
		return
	}
	parts := strings.Split(strings.TrimPrefix(rangeHeader, "bytes="), ",")
	// Поддерживаем только один диапазон
	rangeSpec := strings.TrimSpace(parts[0])
	se := strings.Split(rangeSpec, "-")
	if len(se) != 2 {
		w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
		return
	}
	var start, end int64
	var perr error
	if se[0] == "" { // suffix bytes: -N
		// последние N байт
		n, perr := strconv.ParseInt(se[1], 10, 64)
		if perr != nil || n <= 0 {
			w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
			return
		}
		if n > total {
			n = total
		}
		start = total - n
		end = total - 1
	} else {
		start, perr = strconv.ParseInt(se[0], 10, 64)
		if perr != nil || start < 0 || start >= total {
			w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
			return
		}
		if se[1] == "" {
			end = total - 1
		} else {
			end, perr = strconv.ParseInt(se[1], 10, 64)
			if perr != nil || end < start || end >= total {
				w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
				return
			}
		}
	}
	length := end - start + 1
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, total))
	w.Header().Set("Content-Length", strconv.FormatInt(length, 10))
	w.WriteHeader(http.StatusPartialContent)
	w.Write(fileData[start : end+1])
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
