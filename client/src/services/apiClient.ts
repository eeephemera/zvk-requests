export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface BlobResponse {
  blob: Blob;
  filename: string;
}

function extractMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>;
    if (typeof rec.error === 'string') return rec.error;
    if (typeof rec.message === 'string') return rec.message;
  }
  return fallback;
}

// Base API client configuration
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Helper function to handle API errors
function handleApiError(error: unknown): never {
  if (error instanceof ApiError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new ApiError(error.message, 500);
  }

  throw new ApiError('An unknown error occurred', 500);
}

// Helper function to fetch a blob with filename from content-disposition
export async function fetchBlobWithFilename(endpoint: string): Promise<BlobResponse> {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, { headers });

  if (!response.ok) {
    throw new ApiError('Failed to download file', response.status);
  }

  const contentDisposition = response.headers.get('content-disposition');
  const filenameMatch = contentDisposition?.match(/filename="?(.+?)"?$/);
  const filename = filenameMatch ? filenameMatch[1] : 'download';

  const blob = await response.blob();
  return { blob, filename };
}

// Generic fetch function that other services can use
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const contentType = response.headers.get('content-type');

    if (!response.ok) {
      let errorData: unknown = null;
      let rawText = '';
      try {
        if (contentType?.includes('application/json')) {
          errorData = await response.json();
        } else {
          rawText = await response.text();
        }
      } catch {}

      const message = extractMessage(errorData, rawText || 'Ошибка сервера');
      throw new ApiError(
        message,
        response.status,
        errorData ?? { raw: rawText }
      );
    }

    if (contentType?.includes('application/json')) {
      const data = await response.json();
      // Возвращаем данные напрямую, без обертки
      return data as T;
    }

    return response as unknown as T;
  } catch (error) {
    return handleApiError(error);
  }
}

// Main API client class
export class ApiClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl = BASE_URL, timeout = REQUEST_TIMEOUT) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
  }

  // Generic request method with type safety
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = new Headers(options.headers);
    
    // Удаляем старую логику и ставим новую:
    // НЕ устанавливаем Content-Type, если тело - FormData.
    // Браузер сделает это сам с правильным boundary.
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    
    try {
      const response = await fetch(this.baseUrl + endpoint, {
        ...options,
        headers, // Используем обновленные заголовки
        credentials: 'include',
        signal: AbortSignal.timeout(this.timeout),
      });
      
      if (!response.ok) {
        let parsed: unknown = null;
        let raw = '';
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          parsed = await response.json().catch(() => null);
        } else {
          raw = await response.text().catch(() => '');
        }
        throw new ApiError(
          extractMessage(parsed, raw || `HTTP error! status: ${response.status}`),
          response.status,
          parsed ?? { raw }
        );
      }
      
      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'An unknown error occurred',
        500
      );
    }
  }

  // Typed GET method
  async get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  // Typed POST method
  async post<T, U = unknown>(
    endpoint: string,
    body?: U,
    options: RequestInit = {},
    // Добавляем опциональный колбэк для прогресса
    onUploadProgress?: (progress: number) => void
  ): Promise<T> {
    // Если тело - FormData и есть колбэк, используем XHR
    if (body instanceof FormData && onUploadProgress) {
      return new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", this.baseUrl + endpoint, true);

        // Устанавливаем заголовки, если они есть
        const headers = new Headers(options.headers);
        headers.forEach((value, key) => {
          xhr.setRequestHeader(key, value);
        });
        
        // Отслеживаем прогресс
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onUploadProgress(percentComplete);
          }
        };

        // Обработка завершения запроса
        xhr.onload = () => {
          const ct = xhr.getResponseHeader('content-type') || '';
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              if (ct.includes('application/json')) {
                resolve(JSON.parse(xhr.responseText));
              } else {
                // не JSON — пробуем отдать как есть
                resolve(JSON.parse('{}'));
              }
            } catch {
              resolve(JSON.parse('{}'));
            }
          } else {
            let message = `HTTP error! status: ${xhr.status}`;
            try {
              if (ct.includes('application/json')) {
                const err = JSON.parse(xhr.responseText);
                message = err?.message || err?.error || message;
                reject(new ApiError(message, xhr.status, err));
                return;
              }
            } catch {}
            reject(new ApiError(message, xhr.status, { raw: xhr.responseText }));
          }
        };

        // Обработка ошибок
        xhr.onerror = () => {
          reject(new ApiError('Request failed', xhr.status));
        };

        xhr.send(body);
      });
    }

    // В противном случае используем fetch, как и раньше
    const config: RequestInit = {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    };
    return this.request<T>(endpoint, config);
  }

  // Typed PUT method
  async put<T, U = unknown>(
    endpoint: string,
    body?: U,
    options: RequestInit = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  // Typed DELETE method
  async delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();