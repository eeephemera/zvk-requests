
-- Создаем таблицу пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    login VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'USER', 'MANAGER'
    partner_id INTEGER NULL,    -- Будет ссылаться на partners.id
    contact_details TEXT NULL,  -- Детали контакта для этого пользователя
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Создаем индекс для быстрого поиска по логину
CREATE INDEX idx_users_login ON users(login);

-- Таблица партнеров (наши заказчики)
CREATE TABLE IF NOT EXISTS partners (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,             -- Наименование организации-партнера
    city TEXT NULL,                 -- Город
    inn VARCHAR(12) NULL UNIQUE,    -- ИНН
    partner_status VARCHAR(50) NULL,  -- Статус партнерства
    assigned_manager_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL, -- Менеджер вендора
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска по ИНН и менеджеру
CREATE INDEX idx_partners_inn ON partners(inn);
CREATE INDEX idx_partners_manager ON partners(assigned_manager_id);

-- Добавляем внешний ключ в таблицу users
ALTER TABLE users 
ADD CONSTRAINT fk_users_partner 
FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL;

-- Таблица конечных клиентов (заказчики наших партнеров)
CREATE TABLE IF NOT EXISTS end_clients (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,            -- Наименование организации
    city TEXT NULL,                -- Город
    inn VARCHAR(12) NULL UNIQUE,   -- ИНН
    full_address TEXT NULL,        -- Полный адрес
    contact_person_details TEXT NULL, -- Контактные данные
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по ИНН
CREATE INDEX idx_end_clients_inn ON end_clients(inn);

-- Таблица продуктов (компьютеры и др.)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(100) NOT NULL UNIQUE,  -- Артикул/SKU
    name TEXT NOT NULL,                -- Наименование товара
    description TEXT NULL,             -- Подробное описание/спецификация
    item_type VARCHAR(50) NOT NULL DEFAULT 'PC', -- Тип товара (ПК, и т.д.)
    unit_price NUMERIC(12, 2) NULL,    -- Цена за единицу
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по SKU
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_type ON products(item_type);

-- Таблица заявок (сохраняем название requests, но меняем структуру)
CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    partner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Пользователь-партнер
    partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,  -- Организация-партнер
    end_client_id INTEGER NULL REFERENCES end_clients(id) ON DELETE SET NULL, -- Конечный заказчик
    end_client_details_override TEXT NULL, -- Данные клиента, если он не в БД
    distributor_id INTEGER NULL REFERENCES partners(id) ON DELETE SET NULL, -- Дистрибьютор
    partner_contact_override TEXT NULL, -- Контактные данные партнера для этой заявки
    fz_law_type VARCHAR(10) NULL,      -- 223 или 44 ФЗ
    mpt_registry_type VARCHAR(20) NULL, -- registry или non-registry
    partner_activities TEXT NULL,      -- Активности партнера
    deal_state_description TEXT NULL,  -- Текущее состояние сделки
    estimated_close_date DATE NULL,    -- Предполагаемая дата закрытия
    overall_tz_file BYTEA NULL,        -- Прикрепленный файл ТЗ
    status VARCHAR(50) NOT NULL DEFAULT 'На рассмотрении', -- Статус заявки
    manager_comment TEXT NULL,         -- Комментарий менеджера
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для быстрого поиска
CREATE INDEX idx_requests_partner_user ON requests(partner_user_id);
CREATE INDEX idx_requests_partner ON requests(partner_id);
CREATE INDEX idx_requests_end_client ON requests(end_client_id);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_created_at ON requests(created_at);

-- Таблица элементов спецификации заявки
CREATE TABLE IF NOT EXISTS request_items (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE, -- Связь с заявкой
    product_id INTEGER NULL REFERENCES products(id) ON DELETE SET NULL,   -- Товар (может не быть выбран)
    custom_item_sku TEXT NULL,       -- SKU, введенный пользователем
    custom_item_name TEXT NULL,      -- Наименование, введенное пользователем
    custom_item_description TEXT NULL, -- Описание/спецификация текстом
    quantity INTEGER NOT NULL CHECK (quantity > 0), -- Количество
    unit_price NUMERIC(12, 2) NULL,   -- Цена за единицу
    total_price NUMERIC(14, 2) NULL   -- Общая цена строки
);

-- Индекс для быстрого поиска элементов по заявке
CREATE INDEX idx_request_items_request ON request_items(request_id);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON partners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_end_clients_updated_at BEFORE UPDATE ON end_clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Создание пользователя с ролью MANAGER (для администратора)
INSERT INTO users (login, password_hash, role) 
VALUES ('admin', '$2a$10$dFvnJpVvMnfnF1aOd2d7Z.fKEKfdcZ5hZsIV8HMhxNzlX3HJq6q.2', 'MANAGER'); -- пароль: admin