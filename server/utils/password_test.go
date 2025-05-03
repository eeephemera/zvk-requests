// server/utils/password_test.go
package utils

import (
	"testing" // Импортируем стандартный пакет для тестирования
)

// Тест для HashPassword и CheckPasswordHash
func TestHashAndCheckPassword(t *testing.T) {
	// 1. Задаем тестовый пароль, который проходит валидацию
	password := "MySecretP@ssw0rd"

	// 2. Хешируем пароль
	hashedPassword, err := HashPassword(password)

	// 3. Проверяем, что при хешировании не было ошибки
	if err != nil {
		// t.Fatalf завершает тест немедленно с фатальной ошибкой
		t.Fatalf("HashPassword(%q) returned error: %v", password, err)
	}

	// 4. Проверяем, что хеш не пустой и не равен исходному паролю
	if hashedPassword == "" {
		t.Errorf("HashPassword(%q) returned an empty hash", password)
	}
	if hashedPassword == password {
		t.Errorf("HashPassword(%q) returned the original password, hashing failed", password)
	}

	// 5. Проверяем корректный пароль с хешем
	err = CheckPasswordHash(password, hashedPassword)
	if err != nil {
		// t.Errorf сообщает об ошибке, но продолжает выполнение теста
		t.Errorf("CheckPasswordHash(%q, %q) returned error for correct password: %v", password, hashedPassword, err)
	}

	// 6. Проверяем НЕкорректный пароль с тем же хешем
	wrongPassword := "wrongpassword"
	err = CheckPasswordHash(wrongPassword, hashedPassword)
	// Ожидаем ошибку для неверного пароля
	if err == nil {
		t.Errorf("CheckPasswordHash(%q, %q) did not return error for incorrect password", wrongPassword, hashedPassword)
	}

	// Дополнительно можно проверить тип ошибки, если CheckPasswordHash возвращает специфичную ошибку
	// Например: if !errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) { ... }
}

// Тест для ValidatePassword
func TestValidatePassword(t *testing.T) {
	// Определяем тестовые случаи
	testCases := []struct {
		name        string // Имя тестового случая
		password    string // Тестируемый пароль
		expectError bool   // Ожидаем ли ошибку?
	}{
		{
			name:        "Valid Password",
			password:    "ValidP@ssw0rd", // Соответствует требованиям (предполагаемым)
			expectError: false,
		},
		{
			name:        "Too Short",
			password:    "Short1", // Слишком короткий (предположим, минимум 8)
			expectError: true,
		},
		{
			name:        "No Digit",
			password:    "PasswordWithoutDigit",
			expectError: true,
		},
		{
			name:        "No Uppercase Letter", // Если требуется
			password:    "nouppercase123",
			expectError: true, // Установи true, если заглавные буквы обязательны
		},
		{
			name:        "No Lowercase Letter", // Если требуется
			password:    "NOLOWERCASE123",
			expectError: true, // Установи true, если строчные буквы обязательны
		},
		{
			name:        "No Special Character", // Если требуется
			password:    "NoSpecialChar1",
			expectError: true, // Установи true, если спецсимволы обязательны
		},
		// Добавь другие случаи, если правила валидации другие
	}

	// Прогоняем тестовые случаи
	for _, tc := range testCases {
		// t.Run позволяет группировать тесты и видеть отчет по каждому случаю
		t.Run(tc.name, func(t *testing.T) {
			err := ValidatePassword(tc.password)

			// Проверяем, совпадает ли результат с ожиданием
			if tc.expectError && err == nil {
				t.Errorf("ValidatePassword(%q) expected an error, but got nil", tc.password)
			}
			if !tc.expectError && err != nil {
				t.Errorf("ValidatePassword(%q) expected no error, but got: %v", tc.password, err)
			}
		})
	}
}

