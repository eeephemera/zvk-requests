-- 1. Создаем ENUM типы
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        CREATE TYPE user_role_enum AS ENUM ('USER', 'MANAGER', 'ADMIN');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status_enum') THEN
        CREATE TYPE request_status_enum AS ENUM ('На рассмотрении', 'Одобрено', 'Отклонено', 'Требует уточнения', 'В работе', 'Выполнено');
    END IF;
END$$;

-- 2. Добавляем индексы для таблицы requests
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON public.requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_partner_id ON public.requests(partner_id);

-- 3. Обновляем таблицу users, чтобы использовать ENUM для роли
-- Добавляем новую колонку с ENUM типом
ALTER TABLE public.users ADD COLUMN role_enum user_role_enum;

-- Копируем и приводим данные из старой колонки в новую
UPDATE public.users SET role_enum = upper(role)::user_role_enum;

-- Удаляем старую колонку
ALTER TABLE public.users DROP COLUMN role;

-- Переименовываем новую колонку
ALTER TABLE public.users RENAME COLUMN role_enum TO role;

-- Устанавливаем NOT NULL ограничение, так как теперь это безопасно
ALTER TABLE public.users ALTER COLUMN role SET NOT NULL;


-- 4. Обновляем таблицу requests, чтобы использовать ENUM для статуса
-- Добавляем новую колонку
ALTER TABLE public.requests ADD COLUMN status_enum request_status_enum;

-- Копируем данные
UPDATE public.requests SET status_enum = status::request_status_enum;

-- Удаляем старую колонку
ALTER TABLE public.requests DROP COLUMN status;

-- Переименовываем новую колонку
ALTER TABLE public.requests RENAME COLUMN status_enum TO status;

-- Устанавливаем NOT NULL и DEFAULT
ALTER TABLE public.requests ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.requests ALTER COLUMN status SET DEFAULT 'На рассмотрении';
