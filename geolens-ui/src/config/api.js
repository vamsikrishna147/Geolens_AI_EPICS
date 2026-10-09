/**
 * GeoLens AI - Centralized API Configuration & Network Utility
 * 
 * Provides environment-based base URL routing, timeout protection for slow
 * internet connections, and sanitized error responses.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * Returns full API endpoint url based on relative or absolute path.
 */
export function getApiUrl(path) {
  if (!path) return API_BASE_URL;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Enhanced fetch wrapper with timeout and network resiliency.
 * Essential for slow internet and flaky mobile connections.
 */
export async function apiFetch(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const fullUrl = getApiUrl(url);

  try {
    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your internet connection and try again.');
    }
    throw error;
  }
}
