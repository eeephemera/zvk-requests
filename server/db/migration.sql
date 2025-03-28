-- Миграция для обновления схемы базы данных
BEGIN;

-- Создаем таблицу computers, если она не существует
CREATE TABLE IF NOT EXISTS public.computers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    article_number VARCHAR(100) UNIQUE,
    description TEXT,
    specifications JSONB,
    price NUMERIC(10, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создаем таблицу partners, если она не существует
CREATE TABLE IF NOT EXISTS public.partners (
    id SERIAL PRIMARY KEY,
    inn VARCHAR(12) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    legal_address TEXT,
    contact_phone VARCHAR(20),
    contact_email TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Изменяем таблицу пользователей, если нет колонки login
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'login') THEN
        ALTER TABLE users RENAME COLUMN username TO login;
    END IF;
    
    -- Добавляем колонки в users, если они не существуют
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'partner_id') THEN
        ALTER TABLE users ADD COLUMN partner_id INTEGER REFERENCES partners(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'first_name') THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_name') THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'position') THEN
        ALTER TABLE users ADD COLUMN "position" VARCHAR(100);
    END IF;
    
    -- Переименование password_hash, если необходимо
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password') 
    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
        ALTER TABLE users RENAME COLUMN password TO password_hash;
    END IF;
END $$;

-- Добавляем колонки в таблицу requests, если они не существуют
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'computer_id') THEN
        ALTER TABLE requests ADD COLUMN computer_id INTEGER REFERENCES computers(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'quantity') THEN
        ALTER TABLE requests ADD COLUMN quantity INTEGER DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests' AND column_name = 'total_price') THEN
        ALTER TABLE requests ADD COLUMN total_price NUMERIC(10, 2);
    END IF;
END $$;

-- Создаем таблицу истории статусов заявок, если она не существует
CREATE TABLE IF NOT EXISTS public.request_status_history (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    status VARCHAR(50) NOT NULL,
    comment TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_request_status_history_request_id ON public.request_status_history(request_id);
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON public.requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_computer_id ON public.requests(computer_id);
CREATE INDEX IF NOT EXISTS idx_users_partner_id ON public.users(partner_id);

COMMIT; 