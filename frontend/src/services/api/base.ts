/**
 * Base API configuration and utilities
 */

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

/**
 * Build URL search params from object
 */
export function buildParams(params: Record<string, string | number | boolean | undefined>): URLSearchParams {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.append(key, String(value));
        }
    });

    return searchParams;
}

/**
 * Sanitize date to YYYY-MM-DD format
 */
export function sanitizeDate(date?: string): string | undefined {
    if (!date) return undefined;
    return date.split('T')[0]?.slice(0, 10);
}

/**
 * Handle API errors consistently
 */
export async function handleResponse<T>(response: Response, fallback?: T): Promise<T> {
    if (!response.ok) {
        console.error(`API Error: ${response.status} ${response.statusText}`);
        if (fallback !== undefined) return fallback;
        throw new Error(`API Error: ${response.status}`);
    }
    return await response.json();
}
