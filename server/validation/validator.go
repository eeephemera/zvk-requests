package validation

import (
	"errors"
	"regexp"
	"time"
)

// Основные ошибки валидации
var (
	ErrRequired      = errors.New("поле обязательно для заполнения")
	ErrInvalidFormat = errors.New("некорректный формат")
	ErrOutOfRange    = errors.New("значение вне допустимого диапазона")
	ErrInvalidOption = errors.New("недопустимое значение")
)

// Регулярные выражения для валидации
var (
	innRegex           = regexp.MustCompile(`^\d{10}$|^\d{12}$`)
	emailRegex         = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	phoneRegex         = regexp.MustCompile(`^\+7[0-9]{10}$`)
	latinCyrillicRegex = regexp.MustCompile(`^[a-zA-Zа-яА-ЯёЁ0-9\s\-]+$`)
)

// ValidateINN проверяет корректность ИНН
func ValidateINN(inn string) error {
	if inn == "" {
		return ErrRequired
	}
	if !innRegex.MatchString(inn) {
		return errors.New("ИНН должен содержать 10 или 12 цифр")
	}
	return nil
}

// ValidateEmail проверяет корректность email
func ValidateEmail(email string) error {
	if email == "" {
		return nil // Email может быть опциональным
	}
	if !emailRegex.MatchString(email) {
		return errors.New("некорректный формат email")
	}
	return nil
}

// ValidatePhone проверяет корректность телефона
func ValidatePhone(phone string) error {
	if phone == "" {
		return nil // Телефон может быть опциональным
	}
	if !phoneRegex.MatchString(phone) {
		return errors.New("телефон должен быть в формате +7XXXXXXXXXX")
	}
	return nil
}

// ValidateOrgName проверяет корректность названия организации
func ValidateOrgName(name string) error {
	if name == "" {
		return ErrRequired
	}
	if len(name) < 2 || len(name) > 255 {
		return errors.New("название организации должно содержать от 2 до 255 символов")
	}
	if !latinCyrillicRegex.MatchString(name) {
		return errors.New("название организации может содержать только буквы, цифры, пробелы и дефисы")
	}
	return nil
}

// ValidateFZType проверяет тип ФЗ
func ValidateFZType(fzType string) error {
	if fzType == "" {
		return ErrRequired
	}
	if fzType != "44" && fzType != "223" {
		return errors.New("тип ФЗ должен быть 44 или 223")
	}
	return nil
}

// ValidateRegistryType проверяет тип реестра
func ValidateRegistryType(registryType string) error {
	if registryType == "" {
		return ErrRequired
	}
	if registryType != "registry" && registryType != "non-registry" {
		return errors.New("тип реестра должен быть registry или non-registry")
	}
	return nil
}

// ValidateImplementationDate проверяет дату реализации
func ValidateImplementationDate(date string) error {
	if date == "" {
		return ErrRequired
	}

	// Проверка формата даты
	_, err := time.Parse("2006-01-02", date)
	if err != nil {
		return errors.New("дата должна быть в формате YYYY-MM-DD")
	}

	// Дата не должна быть в прошлом
	today := time.Now().Format("2006-01-02")
	if date < today {
		return errors.New("дата реализации не может быть в прошлом")
	}

	return nil
}
