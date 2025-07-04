import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Alert, Button } from 'react-bootstrap';
import jwtDecode from 'jwt-decode';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchRetryCount = useRef(0);
  const loginRetryCount = useRef(0);
  const registerRetryCount = useRef(0);
  const refreshRetryCount = useRef(0);
  const maxRetries = 3;

  const isValidToken = (token) => {
    if (!token || token.split('.').length !== 3) return false;
    try {
      const decoded = jwtDecode(token);
      const now = Date.now() / 1000;
      if (!decoded.id || !Number.isInteger(decoded.id) || decoded.id <= 0) {
        console.warn('⚠️ Token validation failed: Invalid user ID', {
          decoded: { id: decoded.id, email: decoded.email },
          timestamp: new Date().toISOString(),
        });
        return false;
      }
      return decoded.exp > now;
    } catch (err) {
      console.warn('⚠️ Token validation failed:', {
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      return false;
    }
  };

  const getToken = () => localStorage.getItem('token');

  const getAuthHeaders = useCallback(() => {
    const token = getToken();
    return token && isValidToken(token) ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      console.log(`✅ Attempting to refresh token, timestamp=${new Date().toISOString()}`);
      const response = await axios.post(`${API_BASE}/api/auth/refresh-token`, {}, { withCredentials: true });
      console.log('✅ Token refreshed');
      if (response.data.success && response.data.token && isValidToken(response.data.token)) {
        localStorage.setItem('token', response.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        refreshRetryCount.current = 0;
        return { success: true, token: response.data.token };
      }
      throw new Error('Invalid refresh token response');
    } catch (err) {
      console.error('❌ Failed to refresh token:', {
        status: err.response?.status,
        message: err.message,
        timestamp: new Date().toISOString(),
      });
      if (err.response?.status === 429 && refreshRetryCount.current < maxRetries) {
        refreshRetryCount.current += 1;
        console.log(`✅ Retrying token refresh, attempt ${refreshRetryCount.current}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * refreshRetryCount.current));
        return refreshToken();
      }
      setError(
        err.response?.status === 429 ? t('auth.rateLimit') :
        err.response?.status === 401 ? t('auth.unauthorized') :
        t('auth.refreshFailed')
      );
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      return { success: false, message: t('auth.refreshFailed') };
    }
  }, [t]);

  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      console.warn(`⚠️ No token found, timestamp=${new Date().toISOString()}`);
      setUser(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!isValidToken(token)) {
      console.warn(`⚠️ Token invalid or expired, attempting refresh, timestamp=${new Date().toISOString()}`);
      const refreshResult = await refreshToken();
      if (!refreshResult.success) {
        console.warn(`⚠️ Token refresh failed, clearing token, timestamp=${new Date().toISOString()}`);
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        setLoading(false);
        setError(refreshResult.message);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      const headers = getAuthHeaders();
      console.log(`✅ Fetching user data, token=${token.substring(0, 10)}..., timestamp=${new Date().toISOString()}`);
      const res = await axios.get(`${API_BASE}/api/auth/me`, { headers });
      console.log('✅ User fetched:', { userId: res.data.user?.id, timestamp: new Date().toISOString() });
      if (res.data.success && res.data.user) {
        setUser(res.data.user);
        setError(null);
        fetchRetryCount.current = 0;
      } else {
        throw new Error('No user data');
      }
    } catch (err) {
      console.error('❌ Failed to fetch user:', {
        status: err.response?.status,
        message: err.message,
        userId: jwtDecode(getToken())?.id,
        timestamp: new Date().toISOString(),
      });
      if (err.response?.status === 429 && fetchRetryCount.current < maxRetries) {
        fetchRetryCount.current += 1;
        console.log(`✅ Retrying user fetch, attempt ${fetchRetryCount.current}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * fetchRetryCount.current));
        return fetchUser();
      }
      setError(
        err.response?.status === 401 ? t('auth.unauthorized') :
        err.response?.status === 429 ? t('auth.rateLimit') :
        err.response?.status === 403 ? t('auth.invalidToken') :
        t('auth.fetchError')
      );
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [t, getAuthHeaders, refreshToken]);

  useEffect(() => {
    // Set up axios interceptor for 401 errors
    const interceptor = axios.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          console.log(`✅ Interceptor caught 401, attempting token refresh, timestamp=${new Date().toISOString()}`);
          const refreshResult = await refreshToken();
          if (refreshResult.success) {
            originalRequest.headers['Authorization'] = `Bearer ${refreshResult.token}`;
            return axios(originalRequest);
          }
        }
        return Promise.reject(error);
      }
    );

    fetchUser();

    return () => axios.interceptors.response.eject(interceptor);
  }, [fetchUser, refreshToken]);

  const login = async (email, password) => {
    setLoginLoading(true);
    setError(null);
    try {
      console.log(`✅ Attempting login for ${email}, timestamp=${new Date().toISOString()}`);
      const res = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
      console.log('✅ Login successful', { userId: jwtDecode(res.data.token)?.id, timestamp: new Date().toISOString() });
      if (res.data.success && res.data.token && isValidToken(res.data.token)) {
        localStorage.setItem('token', res.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        await fetchUser();
        loginRetryCount.current = 0;
        setLoginLoading(false);
        return { success: true, message: t('auth.loginSuccess') };
      }
      setLoginLoading(false);
      return { success: false, message: t('auth.noToken') };
    } catch (err) {
      console.error('❌ Login error:', {
        status: err.response?.status,
        message: err.message,
        email,
        timestamp: new Date().toISOString(),
      });
      if (err.response?.status === 429 && loginRetryCount.current < maxRetries) {
        loginRetryCount.current += 1;
        console.log(`✅ Retrying login, attempt ${loginRetryCount.current}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * loginRetryCount.current));
        return login(email, password);
      }
      setLoginLoading(false);
      const message =
        err.response?.status === 400 ? err.response?.data?.message || t('auth.invalidCredentials') :
        err.response?.status === 429 ? t('auth.rateLimit') :
        t('auth.loginFailed');
      setError(message);
      return { success: false, message };
    }
  };

  const register = async (name, email, password) => {
    setRegisterLoading(true);
    setError(null);
    try {
      console.log(`✅ Attempting register for ${email}, timestamp=${new Date().toISOString()}`);
      const res = await axios.post(`${API_BASE}/api/auth/register`, { name, email, password });
      console.log('✅ Register successful', { userId: jwtDecode(res.data.token)?.id, timestamp: new Date().toISOString() });
      if (res.data.success && res.data.token && isValidToken(res.data.token)) {
        localStorage.setItem('token', res.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        await fetchUser();
        registerRetryCount.current = 0;
        setRegisterLoading(false);
        return { success: true, message: t('auth.registerSuccess') };
      }
      setRegisterLoading(false);
      return { success: false, message: t('auth.noToken') };
    } catch (err) {
      console.error('❌ Register error:', {
        status: err.response?.status,
        message: err.message,
        email,
        timestamp: new Date().toISOString(),
      });
      if (err.response?.status === 429 && registerRetryCount.current < maxRetries) {
        registerRetryCount.current += 1;
        console.log(`✅ Retrying register, attempt ${registerRetryCount.current}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * registerRetryCount.current));
        return register(name, email, password);
      }
      setRegisterLoading(false);
      const message =
        err.response?.status === 400 ? err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || t('auth.registerFailed') :
        err.response?.status === 429 ? t('auth.rateLimit') :
        t('auth.registerFailed');
      setError(message);
      return { success: false, message };
    }
  };

  const updateUser = async (data) => {
    setError(null);
    try {
      const token = getToken();
      if (!token || !isValidToken(token)) {
        console.warn(`⚠️ Invalid token for updateUser, timestamp=${new Date().toISOString()}`);
        setError(t('auth.unauthorized'));
        return { success: false, message: t('auth.unauthorized') };
      }
      console.log(`✅ Updating user, userId=${jwtDecode(token)?.id}, timestamp=${new Date().toISOString()}`);
      const res = await axios.put(`${API_BASE}/api/auth/me`, data, {
        headers: getAuthHeaders(),
      });
      console.log('✅ User updated:', { userId: res.data.user?.id, timestamp: new Date().toISOString() });
      setUser(res.data.user);
      if (res.data.token && isValidToken(res.data.token)) {
        localStorage.setItem('token', res.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      }
      setError(null);
      return { success: true, message: t('auth.updateSuccess') };
    } catch (err) {
      console.error('❌ Update user error:', {
        status: err.response?.status,
        message: err.message,
        userId: jwtDecode(getToken())?.id,
        timestamp: new Date().toISOString(),
      });
      setError(
        err.response?.status === 400 ? err.response?.data?.message || t('auth.updateFailed') :
        err.response?.status === 429 ? t('auth.rateLimit') :
        t('auth.updateFailed')
      );
      return { success: false, message: t('auth.updateFailed') };
    }
  };

  const logout = () => {
    console.log(`✅ Logging out user, userId=${user?.id || 'unknown'}, timestamp=${new Date().toISOString()}`);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setError(null);
  };

  const handleRetry = async () => {
    setError(null);
    console.log(`✅ Retrying auth action, timestamp=${new Date().toISOString()}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await fetchUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        register,
        updateUser,
        getToken,
        getAuthHeaders,
        refreshToken,
        loading,
        loginLoading,
        registerLoading,
        error,
      }}
    >
      {error && (
        <Alert
          variant="danger"
          className="position-fixed m-3"
          style={{
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1050,
            maxWidth: '90%',
            width: '500px',
          }}
          dismissible
          onClose={() => setError(null)}
          role="alert"
          aria-live="assertive"
          id="auth-error-alert"
        >
          {error}
          {(error === t('auth.fetchError') || error === t('auth.rateLimit')) && (
            <Button
              variant="link"
              onClick={handleRetry}
              aria-label={t('auth.retry')}
              className="ms-2"
              id="auth-retry-button"
            >
              {t('auth.retry')}
            </Button>
          )}
        </Alert>
      )}
      {children}
    </AuthContext.Provider>
  );
};
