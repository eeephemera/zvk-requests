import { RequestData } from 'next/dist/server/web/types';
 import { apiClient } from './apiClient';

const DRAFT_STORAGE_KEY = 'zvk_request_draft';

interface DraftResponse {
  path: string;
}

/**
 * Saves the current request form data as a draft in localStorage.
 */
export function saveDraft(data: Partial<RequestData>): void {
  try {
    const draftData = JSON.stringify(data);
    localStorage.setItem(DRAFT_STORAGE_KEY, draftData);
  } catch (error) {
    console.error("Failed to save draft to localStorage:", error);
    // Optionally notify the user
  }
}

/**
 * Loads the request draft from localStorage.
 * Returns the draft data or null if no draft exists or fails.
 */
export function loadDraft(): Partial<RequestData> | null {
  // Ensure this code only runs on the client-side
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const draftJson = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (draftJson) {
      return JSON.parse(draftJson);
    }
    return null;
  } catch (error) {
    console.error("Failed to load draft from localStorage:", error);
    // Clean up potentially corrupted data
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }
}

/**
 * Clears the request draft from localStorage.
 */
export function clearDraft(): void {
  // Ensure this code only runs on the client-side
  if (typeof window === 'undefined') {
    return;
  }
  try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (error) {
      console.error("Failed to clear draft from localStorage:", error);
  }
}

/**
 * Creates a draft file by uploading it to the server.
 */
export async function uploadDraft(tzFile: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', tzFile);

  return apiClient.post<DraftResponse>('/api/drafts', formData)
    .then((response: DraftResponse) => response.path);
}