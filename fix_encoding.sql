-- Исправление проблемы с кодировкой
BEGIN;

-- Временно отключаем ограничение проверки
ALTER TABLE users DROP CONSTRAINT users_role_check;

-- Добавляем новое ограничение с цифровыми значениями
ALTER TABLE users ADD COLUMN role_code SMALLINT DEFAULT 1;

-- Обновляем роли в числовом формате
UPDATE users SET role_code = 
  CASE 
    WHEN role LIKE '%ЊҐ­Ґ¤¦Ґа%' THEN 2
    ELSE 1
  END;

-- Удаляем старое текстовое поле role
ALTER TABLE users DROP COLUMN role;

-- Переименовываем числовое поле
ALTER TABLE users RENAME COLUMN role_code TO role;

-- Добавляем новое ограничение на числовое поле
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (1, 2));

COMMIT; 