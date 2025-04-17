import { apiFetch, ApiError } from './apiClient';

// Интерфейс Partner на основе server/models/partner.go
export interface Partner {
  id: number;
  name: string;
  address?: string;        // omitempty -> optional
  inn?: string;            // omitempty -> optional
  partner_status?: string; // omitempty -> optional
  assigned_manager_id?: number; // *int -> optional number
  created_at: string;      // time.Time -> string
  updated_at: string;      // time.Time -> string
}

/**
 * Fetches the list of all available partners.
 * TODO: Implement actual API call when the backend endpoint is ready.
 * Throws ApiError on failure. Returns Partner[] on success.
 */
export async function getPartners(): Promise<Partner[]> {
  console.warn("getPartners: API call not implemented yet.");
  // Заглушка: Возвращаем пустой массив или моковые данные
  // В реальной реализации будет:
  // return await apiFetch<Partner[]>('/api/partners');

  // Пример моковых данных:
  await new Promise(resolve => setTimeout(resolve, 600)); // Имитация задержки сети
  return [
    { id: 101, name: 'ООО "Интегратор Плюс"', partner_status: 'Gold', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), inn: '7712345678' },
    { id: 102, name: 'ИП Системы и Сервис', partner_status: 'Silver', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), inn: '500123456789' },
    { id: 103, name: 'АО "ТехноАльянс"', partner_status: 'Gold', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), inn: '7890123456' },
  ];
  // return [];
} 