// Service functions specifically for Manager role interactions

import { apiFetch, ApiError, fetchBlobWithFilename, PaginatedResponse } from './apiClient';
import type { Request } from './requestService'; // Import Request type

/**
 * Fetches all requests (for manager, paginated).
 * Handles optional filters and sorting.
 * Throws ApiError on failure.
 */
export async function getAllRequests(
  page: number = 1,
  limit: number = 10,
  statusFilter?: string,
  orgFilter?: string,
  sortBy?: string,
  sortOrder?: 'asc' | 'desc'
): Promise<PaginatedResponse<Request>> {
  // Manager endpoint uses offset and limit
  const offset = (page - 1) * limit;
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(), // Use offset for manager endpoint
    page: page.toString(), // Send page as well, backend might use either
  });
  if (statusFilter) params.append('status', statusFilter);
  if (orgFilter) params.append('organization_name', orgFilter); 
  if (sortBy) params.append('sort_by', sortBy);
  if (sortOrder) params.append('sort_order', sortOrder);

  const endpoint = `/api/manager/requests?${params.toString()}`;
  console.log(`Fetching all requests from (manager): ${endpoint}`);

  try {
    return await apiFetch<PaginatedResponse<Request>>(endpoint);
  } catch (err) {
    console.error(`Manager: Error fetching all requests:`, err);
    throw err;
  }
}

/**
 * Fetches a single request by its ID (for manager).
 * Backend might use a different endpoint or logic for managers.
 * Throws ApiError on failure.
 */
export async function getRequestByIdForManager(requestId: number): Promise<Request> {
  if (!requestId) throw new ApiError("Не указан ID заявки.", 400);
  try {
      // Use the specific manager endpoint if it exists, otherwise fallback or adjust
      return await apiFetch<Request>(`/api/manager/requests/${requestId}`); 
  } catch (err) {
      console.error(`Manager: Error fetching request ID ${requestId}:`, err);
      throw err;
  }
}

/**
 * Updates the status of a request (manager action).
 * Throws ApiError on failure. Returns the updated Request.
 */
export async function updateRequestStatus(requestId: number, status: string, comment: string): Promise<Request> {
  if (!requestId || !status) {
    throw new ApiError("Необходимо указать ID заявки и новый статус.", 400);
  }
  try {
    return await apiFetch<Request>(`/api/manager/requests/${requestId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, comment }), 
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(`Manager: Error updating status for request ID ${requestId} to "${status}":`, err);
    throw err;
  }
}

/**
 * Deletes a request (manager action).
 * Throws ApiError on failure.
 */
export async function deleteRequest(requestId: number): Promise<void> {
   if (!requestId) throw new ApiError("Не указан ID заявки для удаления.", 400);
  try {
    await apiFetch<null>(`/api/manager/requests/${requestId}`, { 
      method: 'DELETE',
    });
  } catch (err) {
    console.error(`Manager: Error deleting request ID ${requestId}:`, err);
    throw err;
  }
}

/**
 * Downloads the TZ file for a given request (manager action).
 * Throws ApiError on failure. Returns { blob, filename }.
 */
export async function downloadTzFile(requestId: number): Promise<{ blob: Blob; filename: string }> {
  if (!requestId) throw new ApiError("Не указан ID заявки для скачивания файла ТЗ.", 400);
  try {
      return await fetchBlobWithFilename(`/api/manager/requests/${requestId}/file`);
  } catch (err) {
      console.error(`Manager: Error downloading TZ file for request ID ${requestId}:`, err);
      throw err;
  }
}

/**
 * Example function for downloading other files (if backend supports it).
 * Currently points to the TZ file endpoint as a placeholder.
 */
export async function downloadRequestFile(requestId: number, fileType: string = 'document'): Promise<{ blob: Blob; filename: string }> {
   if (!requestId || !fileType) throw new ApiError("Не указан ID заявки или тип файла.", 400);
   try {
       console.warn(`Attempting to download file type "${fileType}". Ensure backend supports this.`);
       // Uses the TZ file endpoint as placeholder - VERIFY/CHANGE THIS IF NEEDED
       return await fetchBlobWithFilename(`/api/manager/requests/${requestId}/file`); 
   } catch (err) {
       console.error(`Manager: Error downloading file type "${fileType}" for request ID ${requestId}:`, err);
       throw err;
   }
} 

export async function getRequestFiles(requestId: number) : Promise<Array<{ id: number; file_name: string; mime_type: string; file_size: number }>> {
  if (!requestId) throw new ApiError("Не указан ID заявки для списка файлов.", 400);
  return apiFetch(`/api/manager/requests/${requestId}/files`);
}

export async function downloadAllFiles(requestId: number): Promise<void> {
  const files = await getRequestFiles(requestId);
  for (const f of files) {
    try {
      const { blob, filename } = await fetchBlobWithFilename(`/api/manager/requests/files/${f.id}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || f.file_name || `file-${f.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(`Failed to download file ${f.id}`, e);
    }
  }
} 