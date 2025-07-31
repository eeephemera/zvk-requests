-- Этот скрипт удаляет столбец overall_tz_file_id из таблицы requests.
-- ВНИМАНИЕ: Выполняйте этот скрипт только после того, как убедитесь,
-- что данные были успешно перенесены в таблицу request_files
-- с помощью скрипта 001_request_files_setup.up.sql.
 
ALTER TABLE requests
DROP COLUMN IF EXISTS overall_tz_file_id; 