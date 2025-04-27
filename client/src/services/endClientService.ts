import { apiFetch, ApiError } from './apiClient';

// Интерфейс EndClient на основе server/models/end_client.go
export interface EndClient {
  id: number;
  name: string;
  city?: string;                 // omitempty -> optional
  inn?: string;                  // omitempty -> optional
  full_address?: string;         // omitempty -> optional
  contact_person_details?: string; // omitempty -> optional
  created_at: string;           // time.Time -> string
  updated_at: string;           // time.Time -> string
}

/**
 * Finds an end client by their INN.
 * Throws ApiError on network/server errors (besides 404).
 * Returns EndClient if found, null if not found (404).
 */
export async function findEndClientByINN(inn: string): Promise<EndClient | null> {
  if (!inn || inn.length < 10) {
      // Не делаем запрос для некорректного или слишком короткого ИНН
      return null;
  }
  
  try {
    return await apiFetch<EndClient>(`/api/end-clients/search?inn=${encodeURIComponent(inn)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null; // Не найдено - это ожидаемый результат
    }
    console.error("Error finding end client by INN:", err);
    throw err; // Перебрасываем другие ошибки
  }
}
