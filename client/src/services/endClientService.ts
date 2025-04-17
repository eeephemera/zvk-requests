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
 * TODO: Implement actual API call when the backend endpoint is ready.
 * Throws ApiError on network/server errors (besides 404).
 * Returns EndClient if found, null if not found (404).
 */
export async function findEndClientByINN(inn: string): Promise<EndClient | null> {
  console.warn("findEndClientByINN: API call not implemented yet.");
  if (!inn || inn.length < 10) {
      // Не делаем запрос для некорректного или слишком короткого ИНН
      return null;
  }
  // Заглушка: Возвращаем моковые данные или null
  // В реальной реализации будет:
  // try {
  //   return await apiFetch<EndClient>(`/api/end-clients/search?inn=${encodeURIComponent(inn)}`);
  // } catch (err) {
  //   if (err instanceof ApiError && err.status === 404) {
  //     return null; // Не найдено - это ожидаемый результат
  //   }
  //   throw err; // Перебрасываем другие ошибки
  // }

  // Пример моковых данных:
  await new Promise(resolve => setTimeout(resolve, 400)); // Имитация задержки сети
  if (inn === '7701234567') {
    return {
      id: 201,
      name: 'ПАО "Крупный Заказчик"',
      city: 'Москва',
      inn: '7701234567',
      full_address: 'г. Москва, ул. Центральная, 1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } else if (inn === '6609876543') {
     return {
       id: 202,
       name: 'ООО "Перспективные Технологии"',
       city: 'Екатеринбург',
       inn: '6609876543',
       created_at: new Date().toISOString(),
       updated_at: new Date().toISOString(),
     };
  }

  return null; // Не найдено для других ИНН
}

// Опционально: можно добавить функцию для получения списка, если будет такой эндпоинт
// export async function getEndClients(): Promise<EndClient[]> {
//   console.warn("getEndClients: API call not implemented yet.");
//   // return await apiFetch<EndClient[]>('/api/end-clients');
//   return [];
// } 