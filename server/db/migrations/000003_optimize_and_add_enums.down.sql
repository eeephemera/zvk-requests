-- 1. Возвращаем таблицу users к использованию character varying для роли
ALTER TABLE public.users ADD COLUMN role_varchar character varying(50);
UPDATE public.users SET role_varchar = role::text;
ALTER TABLE public.users DROP COLUMN role;
ALTER TABLE public.users RENAME COLUMN role_varchar TO role;
ALTER TABLE public.users ALTER COLUMN role SET NOT NULL;

-- 2. Возвращаем таблицу requests к использованию character varying для статуса
ALTER TABLE public.requests ADD COLUMN status_varchar character varying(50);
UPDATE public.requests SET status_varchar = status::text;
ALTER TABLE public.requests DROP COLUMN status;
ALTER TABLE public.requests RENAME COLUMN status_varchar TO status;
ALTER TABLE public.requests ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.requests ALTER COLUMN status SET DEFAULT 'На рассмотрении'::character varying;

-- 3. Удаляем индексы
DROP INDEX IF EXISTS idx_requests_status;
DROP INDEX IF EXISTS idx_requests_created_at;
DROP INDEX IF EXISTS idx_requests_partner_id;

-- 4. Удаляем ENUM типы (это безопасно, так как они больше не используются)
DROP TYPE IF EXISTS user_role_enum;
DROP TYPE IF EXISTS request_status_enum;
