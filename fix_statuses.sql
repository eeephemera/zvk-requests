-- Исправление таблицы статусов
BEGIN;

-- Убедимся, что таблица статусов существует
CREATE TABLE IF NOT EXISTS statuses (
    name VARCHAR(50) PRIMARY KEY
);

-- Добавляем все необходимые статусы
INSERT INTO statuses (name) VALUES 
    ('На рассмотрении'), 
    ('В работе'), 
    ('Завершена'), 
    ('Отклонена')
ON CONFLICT (name) DO NOTHING;

COMMIT; 