-- Удаляем новые колонки из таблицы requests
ALTER TABLE public.requests
DROP COLUMN IF EXISTS quantity,
DROP COLUMN IF EXISTS unit_price,
DROP COLUMN IF EXISTS total_price,
DROP COLUMN IF EXISTS project_name;

-- Воссоздаем таблицу products
CREATE TABLE IF NOT EXISTS public.products
(
    id serial NOT NULL,
    sku character varying(100) COLLATE pg_catalog."default" NOT NULL,
    name text COLLATE pg_catalog."default" NOT NULL,
    description text COLLATE pg_catalog."default",
    item_type character varying(50) COLLATE pg_catalog."default" NOT NULL DEFAULT 'PC'::character varying,
    unit_price numeric(12, 2),
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT products_pkey PRIMARY KEY (id),
    CONSTRAINT products_sku_key UNIQUE (sku)
);

-- Воссоздаем таблицу request_items
CREATE TABLE IF NOT EXISTS public.request_items
(
    id serial NOT NULL,
    request_id integer NOT NULL,
    product_id integer,
    custom_item_sku text COLLATE pg_catalog."default",
    custom_item_name text COLLATE pg_catalog."default",
    custom_item_description text COLLATE pg_catalog."default",
    quantity integer NOT NULL,
    unit_price numeric(12, 2),
    total_price numeric(14, 2),
    CONSTRAINT request_items_pkey PRIMARY KEY (id)
);

-- Воссоздаем внешние ключи для request_items
ALTER TABLE IF EXISTS public.request_items
    ADD CONSTRAINT request_items_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES public.products (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.request_items
    ADD CONSTRAINT request_items_request_id_fkey FOREIGN KEY (request_id)
    REFERENCES public.requests (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
