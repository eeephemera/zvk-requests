-- 1. Переименование столбца в таблице users
ALTER TABLE public.users 
RENAME COLUMN username TO login;

-- 2. Удаление существующего ограничения уникальности на username
ALTER TABLE public.users
DROP CONSTRAINT users_username_key;

-- 3. Создание нового ограничения уникальности на login
ALTER TABLE public.users
ADD CONSTRAINT users_login_key UNIQUE (login);

-- 4. Обновление администратора (если пароль admin123)
-- Если вы использовали другой пароль, эту команду нужно модифицировать
INSERT INTO users (login, password_hash, role)
VALUES ('admin', '$2a$10$xVCf/k7oU1xJhJ7M.eLp8O4juJKF7V.3YKtGcS5XRrkxrNQMH2Ks2', 'Менеджер')
ON CONFLICT (login) DO NOTHING; 