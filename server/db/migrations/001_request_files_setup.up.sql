-- 1. Создание связующей таблицы request_files
CREATE TABLE IF NOT EXISTS request_files (
    request_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    PRIMARY KEY (request_id, file_id),
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- 2. Перенос существующих данных из requests.overall_tz_file_id в новую таблицу
-- Этот запрос выбирает все заявки, у которых есть связанный файл,
-- и вставляет соответствующие пары (request_id, file_id) в request_files.
INSERT INTO request_files (request_id, file_id)
SELECT id, overall_tz_file_id
FROM requests
WHERE overall_tz_file_id IS NOT NULL
ON CONFLICT (request_id, file_id) DO NOTHING;

-- 3. Добавляем комментарии для ясности
COMMENT ON TABLE request_files IS 'Связующая таблица для отношения многие-ко-многим между заявками и файлами.';
COMMENT ON COLUMN request_files.request_id IS 'ID заявки';
COMMENT ON COLUMN request_files.file_id IS 'ID файла'; 