-- Изменение схемы таблицы users (удаление email)
ALTER TABLE IF EXISTS public.users
    DROP COLUMN IF EXISTS email;

-- Создание начального администратора (пароль: admin123)
INSERT INTO users (username, password_hash, role) 
VALUES ('admin', '$2a$10$xVCf/k7oU1xJhJ7M.eLp8O4juJKF7V.3YKtGcS5XRrkxrNQMH2Ks2', 'Менеджер'); 