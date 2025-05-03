#!/bin/bash

# Скрипт для настройки безопасности перед запуском в production

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Настройка безопасности для production...${NC}"

# Создаем необходимые директории
mkdir -p nginx/conf.d nginx/ssl nginx/logs

# Проверяем наличие .env файла и создаем его, если отсутствует
if [ ! -f server/.env ]; then
    echo -e "${YELLOW}Файл .env не найден. Создаем шаблон...${NC}"
    cat > server/.env << EOF
# Database settings
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=$(openssl rand -base64 16)
DB_NAME=zvk_requests
DB_SSLMODE=disable

# JWT settings
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRATION=24h

# Server settings
SERVER_PORT=8081
APP_ENV=production

# Security settings
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://example.com

# Logging settings
LOG_LEVEL=info
EOF
    echo -e "${GREEN}Файл .env создан. Пожалуйста, настройте его перед запуском!${NC}"
else
    echo -e "${GREEN}Файл .env найден.${NC}"
    # Проверка надежности JWT_SECRET
    JWT_SECRET=$(grep JWT_SECRET server/.env | cut -d '=' -f2)
    if [ ${#JWT_SECRET} -lt 32 ]; then
        echo -e "${RED}ВНИМАНИЕ: JWT_SECRET слишком короткий (< 32 символов). Рекомендуется использовать более длинный секрет.${NC}"
    fi
fi

# Проверяем настройки CORS
CORS_SETTINGS=$(grep CORS_ALLOWED_ORIGINS server/.env | cut -d '=' -f2)
if [[ $CORS_SETTINGS == *"localhost"* ]] && [[ $APP_ENV == "production" ]]; then
    echo -e "${YELLOW}ВНИМАНИЕ: В продакшн режиме разрешен CORS для localhost. Рекомендуется убрать его из списка.${NC}"
fi

# Проверяем наличие SSL сертификатов
if [ ! -f nginx/ssl/certificate.crt ] || [ ! -f nginx/ssl/private.key ]; then
    echo -e "${YELLOW}SSL сертификаты не найдены в nginx/ssl/.${NC}"
    echo -e "${YELLOW}Для продакшена необходимо установить SSL сертификаты:${NC}"
    echo -e "  1. Получите сертификаты от доверенного центра сертификации (Let's Encrypt и т.д.)"
    echo -e "  2. Поместите файлы certificate.crt и private.key в директорию nginx/ssl/"
    echo -e "  3. Обновите конфигурацию в nginx/conf.d/default.conf, если имена файлов отличаются"
    
    # Для тестирования можно создать самоподписанные сертификаты
    read -p "Создать самоподписанные сертификаты для тестирования? (y/n): " CREATE_SELF_SIGNED
    if [[ $CREATE_SELF_SIGNED == "y" ]]; then
        echo -e "${YELLOW}Создание самоподписанных сертификатов для тестирования...${NC}"
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout nginx/ssl/private.key -out nginx/ssl/certificate.crt
        echo -e "${GREEN}Самоподписанные сертификаты созданы.${NC}"
        echo -e "${RED}ВНИМАНИЕ: Используйте их только для тестирования!${NC}"
    fi
else
    echo -e "${GREEN}SSL сертификаты найдены.${NC}"
fi

# Проверка настроек Docker Compose
if [ -f docker-compose.yml ]; then
    # Проверяем, используется ли secure_password_here
    DEFAULT_PASSWORD=$(grep -c "secure_password_here" docker-compose.yml)
    if [ $DEFAULT_PASSWORD -gt 0 ]; then
        echo -e "${RED}ВНИМАНИЕ: В docker-compose.yml используются стандартные пароли. Замените их перед запуском!${NC}"
    fi
    
    # Проверяем, открыт ли порт базы данных наружу
    DB_PORT_EXPOSED=$(grep -c "5433:5432" docker-compose.yml)
    if [ $DB_PORT_EXPOSED -gt 0 ]; then
        echo -e "${YELLOW}ВНИМАНИЕ: В docker-compose.yml порт базы данных открыт наружу. В продакшене рекомендуется закрыть его.${NC}"
    fi
else
    echo -e "${YELLOW}Файл docker-compose.yml не найден.${NC}"
fi

echo -e "${GREEN}Проверка завершена. Ниже приведены рекомендации для повышения безопасности:${NC}"
echo -e "1. Убедитесь, что переменные окружения не содержат чувствительных данных в коде"
echo -e "2. Настройте брандмауэр, разрешая только необходимый трафик (порты 80, 443)"
echo -e "3. Настройте регулярное резервное копирование базы данных"
echo -e "4. Регулярно обновляйте зависимости и операционную систему"
echo -e "5. Рассмотрите возможность использования Docker Secrets для хранения чувствительных данных"
echo -e "6. Настройте мониторинг и логирование для отслеживания подозрительной активности"
echo -e "7. Регулярно проводите аудит безопасности вашего приложения"

echo -e "${GREEN}Готово!${NC}" 