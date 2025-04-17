import { apiFetch, ApiError } from './apiClient';

// Интерфейс Product на основе server/models/product.go
export interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string; // omitempty -> optional
  item_type: string;
  unit_price?: number; // *float64 -> optional number
  created_at: string; // time.Time -> string
  updated_at: string; // time.Time -> string
}

/**
 * Fetches the list of all available products.
 * TODO: Implement actual API call when the backend endpoint is ready.
 * Throws ApiError on failure. Returns Product[] on success.
 */
export async function getProducts(): Promise<Product[]> {
  console.warn("getProducts: API call not implemented yet.");
  // Заглушка: Возвращаем пустой массив или моковые данные
  // В реальной реализации будет:
  // return await apiFetch<Product[]>('/api/products'); 
  
  // Пример моковых данных:
  await new Promise(resolve => setTimeout(resolve, 500)); // Имитация задержки сети
  return [
      { id: 1, sku: 'HW-SERV-01', name: 'Сервер "Атлант"', item_type: 'Hardware', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 2, sku: 'SW-CRM-YR', name: 'Лицензия CRM Pro (1 год)', item_type: 'Software', unit_price: 50000, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 3, sku: 'SVC-SETUP-01', name: 'Услуга установки сервера', item_type: 'Service', unit_price: 25000, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  ];
  // return []; // Или просто пустой массив
} 