package models

import "time"

// File представляет файл, загруженный в систему
type File struct {
	ID        int       `json:"id"`
	FileName  string    `json:"file_name"`
	MimeType  string    `json:"mime_type"`
	FileSize  int64     `json:"file_size"`
	FileData  []byte    `json:"-"` // Данные файла не отправляем в JSON по умолчанию
	CreatedAt time.Time `json:"created_at"`
}
