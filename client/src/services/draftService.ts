import type { RequestData } from './requestService'; // Import type definition

const DRAFT_STORAGE_KEY = 'zvk_request_draft';

/**
 * Saves the current request form data as a draft in localStorage.
 * Excludes the File object.
 */
export function saveDraft(data: Partial<RequestData>): void {
  try {
    // Don't save the File object in localStorage
    const { tzFile, ...restData } = data;
    const draftData = JSON.stringify(restData);
    localStorage.setItem(DRAFT_STORAGE_KEY, draftData);
  } catch (error) {
    console.error("Failed to save draft to localStorage:", error);
    // Optionally notify the user
  }
}

/**
 * Loads the request draft from localStorage.
 * Returns the draft data (excluding the file) or null if no draft exists or fails.
 */
export function loadDraft(): Partial<Omit<RequestData, 'tzFile'>> | null {
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