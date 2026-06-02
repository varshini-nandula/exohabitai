import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor — attach JWT token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('exohabitai_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle auth errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // Token expired or invalid — clear auth and redirect
      if (status === 401) {
        const errorCode = data?.error_code;
        if (errorCode === 'token_expired' || errorCode === 'invalid_token') {
          localStorage.removeItem('exohabitai_token');
          localStorage.removeItem('exohabitai_user');
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Extract a user-friendly error message from an Axios error.
 */
export function extractError(error) {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.response?.status === 429) {
    return 'Rate limit exceeded. Please wait a moment and try again.';
  }
  if (error.code === 'ECONNABORTED') {
    return 'Request timed out. Please try again.';
  }
  if (!error.response) {
    return 'Network error. Please check your connection and ensure the backend is running.';
  }
  return 'An unexpected error occurred. Please try again.';
}

export default client;
