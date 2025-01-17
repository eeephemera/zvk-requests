CREATE TABLE requests (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  inn CHAR(10) NOT NULL,
  request_type TEXT,
  distributor TEXT,
  manager TEXT,
  status TEXT DEFAULT 'Новый',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Менеджер', 'Пользователь')),  -- Ограничиваем возможные значения
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


