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

  // Auto-attach admin authentication token if requesting admin endpoints
  const headers = { ...(options.headers || {}) };
  const adminToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('geolens_admin_token') : null;
  if (adminToken && !headers['X-Admin-Key'] && !headers['Authorization']) {
    headers['X-Admin-Key'] = adminToken;
  }

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
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
