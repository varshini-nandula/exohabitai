import axios from 'axios';

// In development, requests go to '/api' and Vite proxies them to the backend
// (see vite.config.js). In production, set VITE_API_URL to the backend origin.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
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

const DB_FIELD_MAP = {
  P_RADIUS: 'Planet Radius',
  P_MASS: 'Planet Mass',
  P_DENSITY: 'Planet Density',
  P_TEMP_SURF: 'Surface Temperature',
  P_PERIOD: 'Orbital Period',
  P_SEMI_MAJOR_AXIS: 'Semi-Major Axis',
  P_ECCENTRICITY: 'Eccentricity',
  P_INCLINATION: 'Inclination',
  P_HILL_SPHERE: 'Hill Sphere',
  S_TEMPERATURE: 'Stellar Temperature',
  S_LUMINOSITY: 'Stellar Luminosity',
  S_METALLICITY: 'Stellar Metallicity',
  S_MAG: 'Apparent Magnitude',
  S_DISTANCE: 'Distance',
  S_MASS: 'Stellar Mass',
  S_RADIUS: 'Stellar Radius',
  S_AGE: 'Stellar Age',
  S_LOG_G: 'Stellar Surface Gravity',
};

function sanitizeErrorText(msg) {
  if (typeof msg !== 'string') return msg;
  let sanitized = msg;
  for (const [key, label] of Object.entries(DB_FIELD_MAP)) {
    // Replace whole word occurrences of the DB field key
    const regex = new RegExp(`\\b${key}\\b`, 'g');
    sanitized = sanitized.replace(regex, label);
  }
  return sanitized;
}

/**
 * Extract a user-friendly error message from an Axios error.
 */
export function extractError(error) {
  if (error.response?.data?.message) {
    return sanitizeErrorText(error.response.data.message);
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
