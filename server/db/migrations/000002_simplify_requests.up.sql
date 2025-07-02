-- Удаляем внешние ключи, которые ссылаются на удаляемые таблицы
ALTER TABLE IF EXISTS public.request_items DROP CONSTRAINT IF EXISTS request_items_product_id_fkey;

-- Удаляем сами таблицы
DROP TABLE IF EXISTS public.request_items;
DROP TABLE IF EXISTS public.products;

-- Добавляем новые колонки в таблицу requests
ALTER TABLE public.requests
ADD COLUMN quantity integer,
ADD COLUMN unit_price numeric(12, 2),
ADD COLUMN total_price numeric(14, 2),
ADD COLUMN project_name text;
