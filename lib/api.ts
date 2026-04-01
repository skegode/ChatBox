import axios, { AxiosError } from "axios";


// Use env var `NEXT_PUBLIC_API_URL` (recommended) or `REACT_APP_API_BASE_URL` if set.
// Falls back to the online API when not provided so the UI works without a local backend.
const DEFAULT_API_URL = "https://app.servicesuitecloud.com/WhatsappApi";
const ENV_API_URL = typeof process !== 'undefined'
  ? process.env.NEXT_PUBLIC_API_URL || (process.env as unknown as Record<string, string | undefined>).REACT_APP_API_BASE_URL
  : undefined;

// Choose base URL differently for server vs browser:
// - Server-side (SSR): keep absolute upstream so server requests reach the backend.
// - Browser: prefer same-origin (empty base) so relative client calls hit our proxy and avoid CORS.
let computedBase = ENV_API_URL || DEFAULT_API_URL;
if (typeof window !== 'undefined') {
  // Running in the browser: force same-origin in production so the client hits our proxy
  // and avoids CORS. In local development, allow NEXT_PUBLIC_LOCAL_API to point to a local backend.
  if (process.env.NODE_ENV === 'production') {
    computedBase = '';
  } else {
    computedBase = process.env.NEXT_PUBLIC_LOCAL_API || ENV_API_URL || '' || 'http://localhost:5265';
  }
}
const BASE_API_URL = String(computedBase || '').replace(/\/+$/, "");

// export MEDIA_BASE_URL with a trailing slash so callers can safely append paths
export const MEDIA_BASE_URL = BASE_API_URL ? `${BASE_API_URL}/` : '/';

// Create axios instance with proper configuration
const api = axios.create({
  // Use centralized base URL
  baseURL: BASE_API_URL,
  //baseURL:"https://localhost:7003",
  withCredentials: true,
  headers: {
    Accept: "application/json",
  },
});

// Custom ApiError that preserves instanceof Error and adds fields
export class ApiError extends Error {
  public isApiError = true;
  public statusCode?: number;
  public responseData?: unknown;
  public code?: string;
  public config?: unknown;
  public errorMessage?: string;

  constructor(message: string, opts?: { statusCode?: number; responseData?: unknown; code?: string; config?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.statusCode = opts?.statusCode;
    this.responseData = opts?.responseData;
    this.code = opts?.code;
    this.config = opts?.config;
    this.errorMessage = message;

    // restore prototype chain (important when transpiled)
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Type guard for client code
export function isApiError(err: unknown): err is ApiError {
  if (err instanceof ApiError) return true;
  if (err instanceof Error) {
    const maybe = err as unknown as Record<string, unknown>;
    return maybe?.["isApiError"] === true;
  }
  return false;
}

// Helpers to safely read properties from unknown payloads
function getStringProp(obj: unknown, key: string): string | undefined {
  if (obj && typeof obj === "object") {
    const rec = obj as Record<string, unknown>;
    const val = rec[key];
    return typeof val === "string" ? val : undefined;
  }
  return undefined;
}

function getProp(obj: unknown, key: string): unknown | undefined {
  if (obj && typeof obj === "object") {
    const rec = obj as Record<string, unknown>;
    return rec[key];
  }
  return undefined;
}

// Add request interceptor for auth and debugging
api.interceptors.request.use((config) => {
  // Attach JWT token if available
  let token: string | null = null;
  if (typeof localStorage !== "undefined") token = localStorage.getItem("token");
  // fallback: sessionStorage
  if (!token && typeof sessionStorage !== "undefined") token = sessionStorage.getItem("token");
  // fallback: cookie named 'token'
  if (!token && typeof document !== "undefined") {
    const m = document.cookie.match(new RegExp('(^|; )' + 'token' + '=([^;]+)'));
    if (m) token = decodeURIComponent(m[2]);
  }
  if (token) {
    config.headers = config.headers || {};
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - axios header typing can be strict here
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  // If the request targets server auth endpoints, route it to the same-origin proxy
  // Route all same-origin API calls through our proxy in production/preview so we avoid CORS
  if (config.url && typeof config.url === 'string' && config.url.startsWith('/api/')) {
    // Avoid double-rewriting if already targeting the proxy
    if (!config.url.startsWith('/api/proxy')) {
      // /api/Chats -> /api/proxy/Chats (proxy will forward to upstream)
      config.url = config.url.replace(/^\/api\//, '/api/proxy/');
      config.baseURL = '';
    }
  }

  console.log(`📤 API Request: ${String(config.method).toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

// Add response interceptor with improved error handling
api.interceptors.response.use(
  (response) => {
    console.log(`📥 API Response: ${response.status} from ${response.config.url}`);
    return response;
  },
  (error: unknown) => {
    // Handle axios errors separately for richer diagnostics
    if (axios.isAxiosError(error)) {
      const ae = error as AxiosError;
      const status = ae.response?.status;
      const data = ae.response?.data;
      const config = ae.config;
      const method = (config?.method || "UNKNOWN").toString().toUpperCase();
      const url = config?.url;
      // Attempt silent token refresh on 401 once, then retry original request
      try {
        const originalConfig = config as any;
        if (status === 401 && originalConfig && !originalConfig._retry) {
          originalConfig._retry = true;
          // call refresh endpoint through proxy; must set credentials if backend uses cookies
          return fetch('/api/Auth/refresh', { method: 'POST', credentials: 'include' })
            .then(async (res) => {
              if (!res.ok) throw new Error('Refresh failed');
              let body: any = {};
              try { body = await res.json(); } catch (e) { body = {}; }
              const newToken = getStringProp(body, 'token') || getStringProp(body, 'accessToken') || (body && (body as any).token);
              if (newToken && typeof window !== 'undefined') {
                try { localStorage.setItem('token', String(newToken)); } catch (e) { /* ignore */ }
                // update axios instance default header so subsequent requests include token
                (api.defaults.headers as any) = (api.defaults.headers as any) || {};
                (api.defaults.headers as any)['Authorization'] = `Bearer ${newToken}`;
                // ensure the original request includes new header
                originalConfig.headers = originalConfig.headers || {};
                originalConfig.headers['Authorization'] = `Bearer ${newToken}`;
              }
              return api.request(originalConfig);
            })
            .catch((e) => {
              // Refresh failed: clear client-side auth and redirect to login
              try { if (typeof localStorage !== 'undefined') { localStorage.removeItem('token'); localStorage.removeItem('user'); } } catch (e) {}
              if (typeof window !== 'undefined') window.location.href = '/login';
              const apiErr = new ApiError('Unauthorized', { statusCode: 401, responseData: data, config });
              return Promise.reject(apiErr);
            });
        }
      } catch (ex) {
        // ignore refresh attempt failures and continue to normal error handling below
        console.error('Token refresh attempt failed:', ex);
      }
        // For 404s and expected client errors, avoid noisy full-body dumps.
        if (status) {
          const level = status >= 500 ? console.error : console.warn;
          level(`❌ API Error: ${status} from ${method} ${url}`);

          // For server errors log more context; for client errors keep it concise.
          if (status >= 500) {
            if (data) {
              try {
                const summary = typeof data === 'string' ? String(data).slice(0, 200) : JSON.stringify(data);
                console.error('Full error payload (truncated):', summary);
              } catch (e) {
                console.error('Error reading payload');
              }
            } else {
              console.error('No response data');
            }
          } else {
            // For 4xx (including 404) avoid printing HTML pages or large bodies.
            if (status === 404) {
              console.warn('Resource not found (404). This may be expected for some contacts.');
            } else if (data && typeof data === 'object') {
              const errorMsg = getStringProp(data, 'error') || getStringProp(data, 'message');
              if (errorMsg) console.warn('API message:', errorMsg);
            }
          }
        } else {
          console.warn(`❌ API Error from ${method} ${url}`);
        }

        // If there is a request payload for mutating requests, log it at debug level (warn here)
        if (["POST", "PUT", "PATCH"].includes(method) && config?.data) {
          console.warn('Request payload (truncated):', String(config.data).slice(0, 200));
        }

      const derivedMessage =
        (getStringProp(data, 'error') || getStringProp(data, 'message')) ||
        ae.message ||
        'Unknown API error';

      const apiErr = new ApiError(String(derivedMessage), {
        statusCode: status,
        responseData: data,
        code: ae.code,
        config,
      });

      return Promise.reject(apiErr);
    }

    // Non-axios error (setup or unexpected)
    if (error instanceof Error) {
      console.error("❌ API Error:", error.message);
      console.error("Error stack:", error.stack);
      const apiErr = new ApiError(error.message);
      return Promise.reject(apiErr);
    }

    // Fallback
    console.error("❌ API Error: unknown error object", error);
    const apiErr = new ApiError("Unknown API error");
    return Promise.reject(apiErr);
  }
);

export default api;