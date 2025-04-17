import { Request } from './requestService'; // May need adjustment after full refactor

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
export const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Custom Error class for API errors.
 */
export class ApiError extends Error {
  status: number;
  data: any; // Store additional error data if available

  constructor(message: string, status: number, data: any = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    // Maintain stack trace (useful for debugging)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Interface for paginated responses.
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  // Add other potential pagination fields from backend if needed (e.g., page, limit)
  page?: number;
  limit?: number;
}


// --- Core API Fetch Logic ---

/**
 * Performs a fetch request to the API, handling common logic like:
 * - Prepending base URL
 * - Setting credentials mode
 * - Handling JSON parsing
 * - Throwing ApiError on non-ok responses
 * - Handling timeouts
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const url = `${BASE_URL}${endpoint}`;
  console.log(`apiFetch: ${options.method || 'GET'} ${url}`); // Keep basic request log

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        // Default headers - can be overridden by options.headers
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), // Don't set Content-Type for FormData
        Accept: 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Send cookies
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: any = null;
      let errorMessage = `HTTP error ${response.status}: ${response.statusText}`;
      try {
        // Attempt to parse error response body for more details
        errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage; // Use backend error message if available
        console.error(`API Error ${response.status} on ${endpoint}:`, errorData);
      } catch (parseError) {
        // If response is not JSON or empty
        console.error(`API Error ${response.status} on ${endpoint}: Could not parse error response.`);
        // Fallback to status text if JSON parsing fails
        errorMessage = response.statusText || `HTTP error ${response.status}`;
      }
      throw new ApiError(errorMessage, response.status, errorData);
    }

    // Handle successful responses
    // Check for 204 No Content or if the method might not return a body
    if (response.status === 204 || options.method === 'DELETE') {
      // Return null or an appropriate value for void/no-content responses
      // Using 'as T' here requires careful usage, ensure the caller expects null/void.
      return null as T; 
    }

    // For other successful responses, parse JSON
    return await response.json() as T;

  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) {
      // Re-throw ApiError directly
      throw error;
    } else if (error instanceof Error && error.name === 'AbortError') {
      // Handle timeout specifically
      console.error(`API request timed out: ${endpoint}`);
      throw new ApiError(`Превышен лимит ожидания (${REQUEST_TIMEOUT / 1000} сек.)`, 408);
    } else {
      // Handle network errors or other unexpected errors
      console.error(`Network or unexpected error during API fetch to ${endpoint}:`, error);
      throw new ApiError("Ошибка сети или непредвиденная ошибка. Проверьте подключение или попробуйте позже.", 503); // 503 Service Unavailable might be appropriate
    }
  }
}

/**
 * Fetches a Blob from the API and attempts to extract the filename from
 * the Content-Disposition header.
 * Throws ApiError on failure.
 */
export async function fetchBlobWithFilename(endpoint: string, options: RequestInit = {}): Promise<{ blob: Blob; filename: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  const url = `${BASE_URL}${endpoint}`;
  console.log(`fetchBlob: ${options.method || 'GET'} ${url}`); // Keep basic request log

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: any = null;
      let errorMessage = `HTTP error ${response.status}`; 
      try {
        errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch { /* Ignore if error response isn't JSON */ }
      throw new ApiError(errorMessage, response.status, errorData);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition');
    let filename = 'downloaded_file'; // Default filename
    if (disposition && disposition.includes('filename=')) {
      const filenameMatch = disposition.match(/filename\*?="?([^;"\n]*)"?/i);
      if (filenameMatch && filenameMatch[1]) {
        try {
            // Decode URI component and replace underscores with spaces (common practice)
            filename = decodeURIComponent(filenameMatch[1].replace(/\+/g, ' '));
        } catch (e) {
            console.error("Error decoding filename:", e);
            filename = filenameMatch[1]; // Use raw filename if decoding fails
        }
      }
    }

    return { blob, filename };

  } catch (error) {
    clearTimeout(timeoutId);
     if (error instanceof ApiError) {
      throw error;
    } else if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(`Превышен лимит ожидания (${REQUEST_TIMEOUT / 1000} сек.)`, 408);
    } else {
      console.error(`Network or unexpected error during blob fetch from ${endpoint}:`, error);
      throw new ApiError("Ошибка сети при скачивании файла.", 503);
    }
  }
} 