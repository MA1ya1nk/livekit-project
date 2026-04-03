import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth.js';
import { clearTokens } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const timeoutMs = 8000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );
    try {
      const data = await Promise.race([authApi.me(), timeoutPromise]);
      setUser(data);
      setLoading(false);
      return data;
    } catch {
      setUser(null);
      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const onLogout = () => {
      setUser(null);
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const login = useCallback(async (payload) => {
    await authApi.login(payload);
    const user = await loadUser();
    return user;
  }, [loadUser]);

  const signup = useCallback(async (payload) => {
    await authApi.signup(payload);
    await loadUser();
  }, [loadUser]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    // Let UI pages clear any user-specific persisted data.
    window.dispatchEvent(new Event('auth:logout'));
  }, []);

  const updatePassword = useCallback((payload) => authApi.updatePassword(payload), []);

  const value = { user, loading, login, signup, logout, refreshUser: loadUser, updatePassword };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
