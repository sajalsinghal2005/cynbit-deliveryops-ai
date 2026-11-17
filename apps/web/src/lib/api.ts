export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.PROD ? '' : 'http://localhost:4000');

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let inMemoryCsrfToken: string | null = null;
let csrfFetchPromise: Promise<string | null> | null = null;

export function setCsrfToken(token: string | null) {
  inMemoryCsrfToken = token;
}

/**
 * Extracts the CSRF token from the non-httpOnly `bizops_csrf` cookie,
 * falling back to the in-memory token obtained during authentication.
 */
export function getCsrfToken(): string | null {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)bizops_csrf=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return inMemoryCsrfToken;
}

/**
 * Proactively acquires or refreshes a valid CSRF token from the backend.
 * Uses promise de-duplication to prevent concurrent duplicate round-trips.
 * Never stores tokens in localStorage or sessionStorage.
 */
export async function fetchCsrfToken(): Promise<string | null> {
  if (csrfFetchPromise) {
    return csrfFetchPromise;
  }

  csrfFetchPromise = (async () => {
    try {
      const url = `${API_BASE_URL ? API_BASE_URL : ''}/api/auth/csrf`;
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.csrfToken === 'string' && data.csrfToken.trim() !== '') {
          setCsrfToken(data.csrfToken);
          return data.csrfToken;
        }
      }
    } catch {
      // Graceful error recovery: returns current inMemoryCsrfToken if network fails
    } finally {
      csrfFetchPromise = null;
    }
    return inMemoryCsrfToken;
  })();

  return csrfFetchPromise;
}

/**
 * Core fetch wrapper that guarantees:
 * 1. credentials: "include" for session cookie persistence across origins.
 * 2. Automatic X-CSRF-Token header attachment on mutating requests.
 * 3. Proactive acquisition and safe single-retry token renewal on CSRF invalidation.
 * 4. Proper JSON body encoding and Content-Type headers.
 * 5. Consistent ApiError extraction on non-2xx responses.
 * 6. Automatic session-expired event dispatching on 401 responses.
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  // Mutating requests require CSRF token when authenticated with cookies
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    let csrfToken = getCsrfToken();
    if (!csrfToken && !headers.has('X-CSRF-Token')) {
      csrfToken = await fetchCsrfToken();
    }
    if (csrfToken && !headers.has('X-CSRF-Token')) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }

  // Set default JSON Content-Type if body is present and not FormData
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  let data: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await response.text();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      data && typeof data === 'object' && data.message
        ? data.message
        : `Request failed with status ${response.status} (${response.statusText})`;

    // Safe CSRF renewal retry: If the server rejected due to an expired/missing CSRF token,
    // fetch a fresh token from /api/auth/csrf and retry the mutating request exactly once.
    const isCsrfError =
      response.status === 403 &&
      typeof errorMessage === 'string' &&
      errorMessage.toLowerCase().includes('csrf');

    if (isCsrfError && !(options as any)._isCsrfRetry) {
      const freshToken = await fetchCsrfToken();
      if (freshToken) {
        headers.set('X-CSRF-Token', freshToken);
        return apiFetch<T>(endpoint, {
          ...options,
          headers,
          _isCsrfRetry: true,
        } as any);
      }
    }

    // Notify application if an active session expired on a protected business endpoint
    if (
      response.status === 401 &&
      typeof window !== 'undefined' &&
      !url.includes('/api/auth/login') &&
      !url.includes('/api/auth/me')
    ) {
      window.dispatchEvent(new CustomEvent('bizops:session-expired'));
    }

    throw new ApiError(errorMessage, response.status, data);
  }

  return data as T;
}

export const api = {
  get: <T = any>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),

  put: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),

  patch: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    }),

  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};
