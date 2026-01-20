/**
 * API Client utility for consistent API calls
 * Handles base URL resolution for dev (Vite proxy) and production
 */

/**
 * Get the base URL for API calls
 * - In dev: Uses relative URL (relies on Vite proxy to localhost:3000)
 * - In prod: Uses relative URL (same origin)
 * - Can be overridden with VITE_API_BASE_URL env var
 */
export function getApiBaseUrl(): string {
  // Allow override via env var (useful for testing or custom setups)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Default: use relative URL (works with Vite proxy in dev, same origin in prod)
  return '';
}

/**
 * Build a full API URL
 * @param endpoint - API endpoint path (e.g., '/api/user-admin' or 'user-admin')
 * @returns Full URL for the API endpoint
 */
export function getApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // If baseUrl is empty, return relative URL (relies on proxy or same origin)
  if (!baseUrl) {
    return cleanEndpoint;
  }
  
  // If baseUrl is set, ensure endpoint starts with /api
  if (!cleanEndpoint.startsWith('/api')) {
    return `${baseUrl}/api${cleanEndpoint}`;
  }
  
  return `${baseUrl}${cleanEndpoint}`;
}

/**
 * Make an authenticated API request
 * @param endpoint - API endpoint path
 * @param options - Fetch options (method, headers, body, etc.)
 * @param requireAuth - Whether to include auth token (default: true)
 * @returns Promise<Response>
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
  requireAuth: boolean = true
): Promise<Response> {
  const url = getApiUrl(endpoint);
  const headers = new Headers(options.headers as HeadersInit);
  
  // Set Content-Type if not already set and body is provided
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  // Add auth token if required
  if (requireAuth) {
    try {
      const { auth } = await import('../firebase/config');
      const currentUser = auth.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        headers.set('Authorization', `Bearer ${idToken}`);
      }
    } catch (error) {
      console.warn('[apiClient] Failed to get auth token:', error);
      // Continue without auth token - let the API handle auth errors
    }
  }
  
  const fetchOptions: RequestInit = {
    ...options,
    headers,
  };
  
  if (import.meta.env.DEV) {
    console.log('[apiClient] Making request:', {
      url,
      method: fetchOptions.method || 'GET',
      hasAuth: headers.has('Authorization'),
      endpoint
    });
  }
  
  try {
    const response = await fetch(url, fetchOptions);
    
    if (import.meta.env.DEV) {
      console.log('[apiClient] Response:', {
        url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
    }
    
    return response;
  } catch (error: any) {
    if (import.meta.env.DEV) {
      console.error('[apiClient] Fetch error:', {
        url,
        error: error.message,
        errorType: error.name,
        baseUrl: getApiBaseUrl(),
        endpoint
      });
    }
    throw error;
  }
}
