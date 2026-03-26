import axios, { AxiosError } from "axios";


// Use env var `NEXT_PUBLIC_API_URL` (recommended) or `REACT_APP_API_BASE_URL` if set.
// Falls back to the online API when not provided so the UI works without a local backend.
const DEFAULT_API_URL = "https://app.servicesuitecloud.com/WhatsappApi";
const ENV_API_URL = typeof process !== 'undefined'
  ? process.env.NEXT_PUBLIC_API_URL || (process.env as unknown as Record<string, string | undefined>).REACT_APP_API_BASE_URL
  : undefined;

// Prefer a local API in browser development so you can test changes locally.
let computedBase = ENV_API_URL || DEFAULT_API_URL;
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  computedBase = process.env.NEXT_PUBLIC_LOCAL_API || 'http://localhost:5265';
}
const BASE_API_URL = String(computedBase).replace(/\/+$/, "");

// export MEDIA_BASE_URL with a trailing slash so callers can safely append paths
export const MEDIA_BASE_URL = `${BASE_API_URL}/`;

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
  if (config.url && typeof config.url === 'string' && config.url.startsWith('/api/Auth')) {
    // rewrite path to our proxy route and force same-origin by clearing baseURL
    config.url = config.url.replace(/^\/api\/Auth/, '/api/proxy/auth');
    config.baseURL = '';
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

      if (status) {
        console.error(`❌ API Error: ${status} from ${method} ${url}`);
      } else {
        console.error(`❌ API Error from ${method} ${url}`);
      }

      if (data) {
        if (typeof data === "object" && data !== null) {
          const errorMsg = getStringProp(data, "error");
          const message = getStringProp(data, "message");
          const validationErrors = getProp(data, "errors");

          if (errorMsg) console.error("Error message:", errorMsg);
          if (message) console.error("Message:", message);
          if (validationErrors) console.error("Validation errors:", validationErrors);
          console.error("Full error payload:", data);
        } else {
          console.error("Error response:", data);
        }
      } else {
        console.error("No response data");
      }

      if (["POST", "PUT", "PATCH"].includes(method)) {
        console.error("Request payload:", config?.data);
      }

      const derivedMessage =
        (getStringProp(data, "error") || getStringProp(data, "message")) ||
        ae.message ||
        "Unknown API error";

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