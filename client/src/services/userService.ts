import { apiFetch } from './apiClient';

// Тип для информации о партнере, связанном с пользователем
interface UserPartner {
    id: number;
    name: string;
    // Можно добавить другие поля партнера при необходимости
}

// Тип для данных пользователя, возвращаемых /api/me
export interface User {
    id: number;
    name: string;
    email: string;
    phone?: string | null; // Телефон может быть необязательным
    role: string; // Роль пользователя (например, 'USER', 'MANAGER')
    partner?: UserPartner | null; // Партнер, к которому привязан пользователь
}

/**
 * Fetches the details of the currently authenticated user.
 * Throws ApiError on failure.
 * @returns {Promise<User>} The user details.
 */
export async function getCurrentUser(): Promise<User> {
    try {
        // API returns user object directly, not wrapped in data property
        const response = await apiFetch<User>('/api/me');
        if (!response) {
            throw new Error('Empty response from /api/me');
        }
        return response;
    } catch (err) {
        console.error("Error fetching current user details:", err);
        throw err;
    }
}