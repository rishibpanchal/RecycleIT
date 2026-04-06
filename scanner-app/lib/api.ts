/**
 * api.ts
 * ======
 * Core API configuration and helpers for BatchTrace app
 */

// Base URL: set NEXT_PUBLIC_API_URL in .env.local to override the default localhost address.
// Example .env.local:
//   NEXT_PUBLIC_API_URL=http://localhost:8000
export const API =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
    'http://localhost:8000';

export const NGROK_HEADERS: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
};

/**
 * Base fetch wrapper with automatic ngrok header injection
 */
export async function apiFetch(path: string, options: RequestInit = {}) {
    const res = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            // Only add ngrok headers if using ngrok (not localhost)
            ...(API.includes('ngrok') ? NGROK_HEADERS : {}),
            ...(options.headers || {}),
        },
    });
    return res.json();
}

/**
 * Check if the backend API is online
 */
export async function checkAPIHealth(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${API}/`, {
            signal: controller.signal,
            headers: API.includes('ngrok') ? NGROK_HEADERS : {},
        });
        clearTimeout(timeout);
        return res.ok;
    } catch {
        return false;
    }
}
