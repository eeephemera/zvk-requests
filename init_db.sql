-- Инициализация базы данных zvk_requests

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    login TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Менеджер', 'Пользователь')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индекс для быстрого поиска по логину
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);

-- Таблица статусов заявок
CREATE TABLE IF NOT EXISTS statuses (
    name VARCHAR(50) PRIMARY KEY
);

-- Добавляем возможные статусы
INSERT INTO statuses VALUES 
    ('На рассмотрении'), 
    ('В работе'), 
    ('Завершена'),
    ('Отклонена')
ON CONFLICT (name) DO NOTHING;

-- Таблица заявок
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    inn VARCHAR(12),
    organization_name VARCHAR(255),
    implementation_date TIMESTAMP,
    fz_type VARCHAR(10),      -- "223" или "44"
    registry_type VARCHAR(50), -- "registry" или "non-registry"
    comment TEXT,
    status VARCHAR(50) DEFAULT 'На рассмотрении' REFERENCES statuses(name),
    tz_file BYTEA,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Создаем индекс для быстрого поиска заявок по пользователю
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);

-- Создаем администратора
INSERT INTO users (login, password_hash, role)
VALUES ('admin', '$2a$10$xVCf/k7oU1xJhJ7M.eLp8O4juJKF7V.3YKtGcS5XRrkxrNQMH2Ks2', 'Менеджер')
ON CONFLICT (login) DO NOTHING; 