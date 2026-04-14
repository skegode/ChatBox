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

// Thrown when the proxy returns a 502 "Proxy timeout" sentinel rather than a generic 502.
export class ProxyTimeoutError extends ApiError {
  constructor(message = 'Request timed out') {
    super(message, { statusCode: 502 });
    this.name = 'ProxyTimeoutError';
    Object.setPrototypeOf(this, ProxyTimeoutError.prototype);
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

function parseNestedErrorDetails(data: unknown): string | undefined {
  const detailsRaw = getProp(data, 'details');
  if (!detailsRaw) return undefined;

  // New backend shape: details may already be an object.
  if (detailsRaw && typeof detailsRaw === 'object') {
    const providerMessage = getStringProp(detailsRaw, 'providerMessage');
    const nestedMessage = getStringProp(detailsRaw, 'message');
    const nestedError = getStringProp(detailsRaw, 'error');
    const code = getProp(detailsRaw, 'code');
    const subcode = getProp(detailsRaw, 'subcode');

    const msg = providerMessage || nestedMessage || nestedError;
    if (msg) {
      const suffix = code || subcode
        ? ` (code ${String(code ?? '')}${subcode ? `/${String(subcode)}` : ''})`
        : '';
      return `${msg}${suffix}`;
    }
    return undefined;
  }

  const details = typeof detailsRaw === 'string' ? detailsRaw : String(detailsRaw);
  const trimmed = details.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = JSON.parse(trimmed);
    const providerMessage = getStringProp(parsed, 'providerMessage');
    if (providerMessage) return providerMessage;
    const nestedError = getStringProp(parsed, 'error');
    if (nestedError) return nestedError;
    const nestedMessage = getStringProp(parsed, 'message');
    if (nestedMessage) return nestedMessage;
    const nestedErrorObj = getProp(parsed, 'error');
    const nestedObjMessage = getStringProp(nestedErrorObj, 'message');
    if (nestedObjMessage) return nestedObjMessage;
  } catch {
    // details is plain string
  }

  return trimmed;
}

// Add request interceptor for auth and debugging
api.interceptors.request.use((config) => {
  const rawUrl = typeof config.url === 'string' ? config.url : '';
  const isLoginRequest = /\/api\/(?:proxy\/)?Auth\/login$/i.test(rawUrl);
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
  if (token && !isLoginRequest) {
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
    const reqId = response.headers['x-request-id'];
    console.log(
      `📥 API Response: ${response.status} from ${response.config.url}${
        reqId ? ` [x-request-id: ${reqId}]` : ''
      }`
    );
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
      const isLoginRequest = typeof url === 'string' && /\/api\/(?:proxy\/)?Auth\/login$/i.test(url);

      // Backend contract: any 401 after login means JWT is expired/invalid.
      if (status === 401 && !isLoginRequest) {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('lastActiveAt');
          }
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('token');
          }
          if (typeof document !== 'undefined') {
            document.cookie = 'token=; Path=/; Max-Age=0; SameSite=Lax';
          }
        } catch (cleanupError) {
          console.warn('Failed to clear auth state after 401:', cleanupError);
        }
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
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
              const errorMsg =
                parseNestedErrorDetails(data) ||
                getStringProp(data, 'error') ||
                getStringProp(data, 'message');
              if (errorMsg) console.warn('API message:', errorMsg);

              const details = getProp(data, 'details');
              if (details && typeof details === 'object') {
                const code = getProp(details, 'code');
                const subcode = getProp(details, 'subcode');
                const provider = getStringProp(details, 'provider');
                const trace = getStringProp(details, 'fbtrace_id');
                const requestEcho = getProp(details, 'request');
                console.warn('API details:', {
                  provider,
                  code,
                  subcode,
                  trace,
                  request: requestEcho,
                });
              }
            }
          }
        } else {
          console.warn(`❌ API Error from ${method} ${url}`);
        }

        // If there is a request payload for mutating requests, log it at debug level (warn here)
        if (["POST", "PUT", "PATCH"].includes(method) && config?.data) {
          console.warn('Request payload:', String(config.data).slice(0, 2000));
        }

      const errorText = getStringProp(data, 'error');
      const messageText = getStringProp(data, 'message');
      const nestedDetails = parseNestedErrorDetails(data);
      const derivedMessage =
        (nestedDetails && errorText ? `${errorText}: ${nestedDetails}` : undefined) ||
        nestedDetails ||
        errorText ||
        messageText ||
        ae.message ||
        'Unknown API error';

      // Proxy surfaces timeout as 502 { error: "Proxy timeout" }.  Use a typed error
      // so callers can distinguish timeouts from other gateway failures.
      if (status === 502 && errorText === 'Proxy timeout') {
        const details = getStringProp(data, 'details') || 'Request timed out';
        return Promise.reject(new ProxyTimeoutError(String(details)));
      }

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