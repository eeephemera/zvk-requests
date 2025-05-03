import { apiFetch } from './apiClient';

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
 * Throws ApiError on failure. Returns Partner[] on success.
 */
export async function getPartners(): Promise<Partner[]> {
  return apiFetch<Partner[]>('/api/partners');
}