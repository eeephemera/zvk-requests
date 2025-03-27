-- Переименование столбца username на login
ALTER TABLE public.users 
RENAME COLUMN username TO login;

-- Удаление существующего ограничения уникальности на username
ALTER TABLE public.users
DROP CONSTRAINT users_username_key;

-- Создание нового ограничения уникальности на login
ALTER TABLE public.users
ADD CONSTRAINT users_login_key UNIQUE (login); 