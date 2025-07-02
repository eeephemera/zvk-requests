-- Создаем ENUM тип для статусов заявок, если он еще не существует
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status_enum') THEN
        CREATE TYPE public.request_status_enum AS ENUM
            ('На рассмотрении', 'В работе', 'На уточнении', 'Одобрена', 'Отклонена', 'Завершена');
    END IF;
END$$; 