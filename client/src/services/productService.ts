import { apiFetch } from './apiClient';

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
 * Throws ApiError on failure. Returns Product[] on success.
 */
export async function getProducts(): Promise<Product[]> {
  try {
    return await apiFetch<Product[]>('/api/products');
  } catch (err) {
    console.error("Error fetching products:", err);
    throw err;
  }
}