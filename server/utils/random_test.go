package utils

import (
	"testing"
)

func TestRandomInt(t *testing.T) {
	tests := []struct {
		name string
		max  int
	}{
		{"Zero", 0},
		{"Small", 10},
		{"Medium", 1000},
		{"Large", 1000000},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := RandomInt(tc.max)

			// Если max равен 0, то результат должен быть 0
			if tc.max == 0 && result != 0 {
				t.Errorf("RandomInt(%d) = %d, want 0", tc.max, result)
			}

			// Для положительных max, результат должен быть в диапазоне [0, max)
			if tc.max > 0 && (result < 0 || result >= tc.max) {
				t.Errorf("RandomInt(%d) = %d, want value in range [0, %d)", tc.max, result, tc.max)
			}
		})
	}
}

func TestGenerateSecureRandomString(t *testing.T) {
	tests := []struct {
		name   string
		length int
	}{
		{"Zero", 0},
		{"Small", 5},
		{"Medium", 16},
		{"Large", 64},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := GenerateSecureRandomString(tc.length)

			// Проверяем, что длина строки равна запрошенной
			if len(result) != tc.length {
				t.Errorf("GenerateSecureRandomString(%d) length = %d, want %d", tc.length, len(result), tc.length)
			}

			// Проверяем, что повторные вызовы возвращают разные значения
			// (с малой вероятностью могут совпасть, но это крайне маловероятно)
			if tc.length > 0 {
				another := GenerateSecureRandomString(tc.length)
				if result == another {
					t.Errorf("GenerateSecureRandomString generated same value twice: %s", result)
				}
			}
		})
	}
}

func TestRandomnessDistribution(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping randomness distribution test in short mode")
	}

	// Проверяем равномерность распределения для RandomInt
	max := 10
	iterations := 10000
	counts := make([]int, max)

	for i := 0; i < iterations; i++ {
		r := RandomInt(max)
		counts[r]++
	}

	// Допустимое отклонение от идеальной равномерности в процентах
	tolerance := 0.15
	expectedCount := iterations / max
	minAcceptable := int(float64(expectedCount) * (1 - tolerance))
	maxAcceptable := int(float64(expectedCount) * (1 + tolerance))

	for i, count := range counts {
		if count < minAcceptable || count > maxAcceptable {
			t.Logf("Value %d occurred %d times (expected range: %d-%d)", i, count, minAcceptable, maxAcceptable)
		}
	}
}
