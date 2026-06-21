import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/auth';
import { extractError } from '../api/client';

export const AuthContext = createContext(null);

/**
 * Decode a JWT payload (without verification — just to read exp).
 */
function decodeJWTPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('exohabitai_token'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const logoutTimerRef = useRef(null);

  const isAuthenticated = !!user && !!token;

  // Clear any surfaced auth error (used by the login/register forms)
  const clearError = useCallback(() => setError(null), []);

  // Clear the auto-logout timer
  const clearLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
  }, []);

  // Schedule auto-logout based on JWT expiration
  const scheduleAutoLogout = useCallback((jwt) => {
    clearLogoutTimer();
    const payload = decodeJWTPayload(jwt);
    if (!payload?.exp) return;

    const expiresAt = payload.exp * 1000; // convert to ms
    const timeUntilExpiry = expiresAt - Date.now();

    if (timeUntilExpiry <= 0) {
      // Already expired
      performLogout();
      return;
    }

    logoutTimerRef.current = setTimeout(() => {
      performLogout();
    }, timeUntilExpiry);
  }, [clearLogoutTimer]);

  // Internal logout helper
  const performLogout = useCallback(() => {
    clearLogoutTimer();
    setUser(null);
    setToken(null);
    localStorage.removeItem('exohabitai_token');
    localStorage.removeItem('exohabitai_user');
  }, [clearLogoutTimer]);

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      const storedToken = localStorage.getItem('exohabitai_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await authAPI.getProfile();
        const userData = response.data.data.user;
        setUser(userData);
        setToken(storedToken);
        scheduleAutoLogout(storedToken);
      } catch {
        // Token invalid or expired
        performLogout();
      } finally {
        setIsLoading(false);
      }
    }

    validateToken();
  }, []);

  // Listen for auth:expired events from the Axios interceptor
  useEffect(() => {
    const handleExpired = () => {
      performLogout();
      navigate('/login');
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [performLogout, navigate]);

  // Login
  const login = useCallback(async (username, password) => {
    try {
      const response = await authAPI.login(username, password);
      const { access_token, user: userData } = response.data.data;

      localStorage.setItem('exohabitai_token', access_token);
      localStorage.setItem('exohabitai_user', JSON.stringify(userData));
      setToken(access_token);
      setUser(userData);
      scheduleAutoLogout(access_token);
      setError(null);

      return userData;
    } catch (err) {
      setError(extractError(err));
      throw err;
    }
  }, [scheduleAutoLogout]);

  // Register + auto-login
  const register = useCallback(async (username, email, password) => {
    try {
      await authAPI.register(username, email, password);
    } catch (err) {
      setError(extractError(err));
      throw err;
    }
    // Auto-login after registration (login sets/clears error itself)
    return login(username, password);
  }, [login]);

  // Logout
  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch {
      // Ignore errors — we're logging out anyway
    }
    performLogout();
    navigate('/');
  }, [performLogout, navigate]);

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    clearError,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
