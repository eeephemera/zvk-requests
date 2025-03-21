CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'На рассмотрении',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Менеджер', 'Пользователь')),  -- Ограничиваем возможные значения
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX idx_users_email ON users(email);


CREATE TABLE statuses (name VARCHAR(50) PRIMARY KEY);
INSERT INTO statuses VALUES ('На рассмотрении'), ('В работе'), ('Завершена');
ALTER TABLE requests ADD FOREIGN KEY (status) REFERENCES statuses(name);

ALTER TABLE requests
ADD COLUMN inn VARCHAR(255),
ADD COLUMN organization_name VARCHAR(255),
ADD COLUMN implementation_date TIMESTAMP,
ADD COLUMN fz_type VARCHAR(10),      -- Для "223" или "44"
ADD COLUMN registry_type VARCHAR(50), -- Для "registry" или "non-registry"
ADD COLUMN comment TEXT;

