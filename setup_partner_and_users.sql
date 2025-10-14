-- Скрипт для создания партнёра и привязки пользователей
-- Выполнить: docker exec -i zvk-requests-postgres-1 psql -U postgres -d zvk_requests < setup_partner_and_users.sql

BEGIN;

-- 1. Создаём партнёра
INSERT INTO partners (name, address, inn, partner_status, assigned_manager_id) 
VALUES (
  'ООО "Тестовый партнёр"',
  'г. Москва, ул. Ленина, д. 1',
  '7712345678',
  'active',
  NULL  -- Пока без менеджера, назначим после создания
)
RETURNING id;

-- Сохраним ID партнёра (будет 1, если это первый партнёр)
-- 2. Привязываем существующего пользователя test (id=1) к партнёру
UPDATE users 
SET partner_id = 1
WHERE id = 1;

-- 3. Создаём менеджера для этого партнёра
-- Пароль: Manager123!
-- Хеш сгенерирован bcrypt cost=10
INSERT INTO users (login, password_hash, role, partner_id, name, email, phone)
VALUES (
  'manager1',
  '$2a$10$YGZKxPQm5vJZoHXqK9X3xOEqP7EZvO5rZ4kW8mBZLFHJDPxN8jGEy',  -- Manager123!
  'MANAGER',
  1,
  'Менеджер Иванов Иван',
  'manager@test.ru',
  '+79991234567'
)
RETURNING id;

-- 4. Назначаем менеджера партнёру
UPDATE partners 
SET assigned_manager_id = (SELECT id FROM users WHERE login = 'manager1')
WHERE id = 1;

-- 5. Создаём ещё одного пользователя (USER) для того же партнёра
-- Пароль: User123!
INSERT INTO users (login, password_hash, role, partner_id, name, email, phone)
VALUES (
  'user2',
  '$2a$10$8rKJHvZ3xYQZ0X8YZ9X3xOEqP7EZvO5rZ4kW8mBZLFHJDPxN8jGEy',  -- User123!
  'USER',
  1,
  'Пользователь Петров Пётр',
  'user2@test.ru',
  '+79991234568'
);

-- Проверка результатов
SELECT 
  u.id, 
  u.login, 
  u.role, 
  u.partner_id,
  u.name,
  p.name as partner_name,
  p.assigned_manager_id,
  m.login as manager_login
FROM users u
LEFT JOIN partners p ON u.partner_id = p.id
LEFT JOIN users m ON p.assigned_manager_id = m.id
ORDER BY u.id;

COMMIT;

-- Вывод итоговой информации
\echo '=== Партнёры ==='
SELECT id, name, inn, partner_status, assigned_manager_id FROM partners;

\echo '=== Пользователи ==='
SELECT id, login, role, partner_id, name FROM users;

