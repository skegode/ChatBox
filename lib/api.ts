import axios from "axios";

// central base URL for API (single source of truth)
const BASE_API_URL = "https://app.servicesuitecloud.com/WhatsappApi";

// export MEDIA_BASE_URL with a trailing slash so callers can safely append paths
export const MEDIA_BASE_URL = `${BASE_API_URL.replace(/\/+$/, "")}/`;

// Create axios instance with proper configuration
const api = axios.create({
  // Use centralized base URL
  //baseURL: BASE_API_URL,
  baseURL:"https://localhost:7003",
  withCredentials: true,
  headers: {   
    'Accept': 'application/json'
  }
});

// Add request interceptor for auth and debugging
api.interceptors.request.use(config => {
  // Attach JWT token if available
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  console.log(`📤 API Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

// Add response interceptor with improved error handling
api.interceptors.response.use(
  response => {
    console.log(`📥 API Response: ${response.status} from ${response.config.url}`);
    return response;
  },
  error => {
    if (error.response) {
      // Server responded with non-2xx status
      const { status, data, config } = error.response;
      const method = config.method?.toUpperCase() || 'UNKNOWN';
      const url = config.url;

      console.error(`❌ API Error: ${status} from ${method} ${url}`);

      // Log detailed error information
      if (data) {
        if (typeof data === 'object') {
          if (data.error) console.error('Error message:', data.error);
          if (data.message) console.error('Message:', data.message);
          if (data.errors) console.error('Validation errors:', data.errors);
          console.error('Full error payload:', data);
        } else {
          console.error('Error response:', data);
        }
      }

      // Add request payload to the log for debugging POST/PUT requests
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        console.error('Request payload:', config.data);
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('❌ API Error: No response received');
      console.error('Request details:', {
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        baseURL: error.config?.baseURL
      });
      console.error('Network status:', navigator.onLine ? 'Online' : 'Offline');
    } else {
      // Error setting up the request
      console.error('❌ API Error:', error.message);
      console.error('Error stack:', error.stack);
    }

    // Transform the error to include more context for components
    const enhancedError = {
      ...error,
      isApiError: true,
      statusCode: error.response?.status,
      responseData: error.response?.data,
      errorMessage: error.response?.data?.error ||
                    error.response?.data?.message ||
                    error.message ||
                    'Unknown API error'
    };

    return Promise.reject(enhancedError);
  }
);

export default api;