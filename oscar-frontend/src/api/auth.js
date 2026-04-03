import client, { setTokens } from './client.js';

export const signup = (payload) =>
  client.post('/api/auth/signup', payload).then((res) => {
    const d = res.data;
    setTokens(d.access_token, d.refresh_token);
    return d;
  });

export const login = (payload) =>
  client.post('/api/auth/login', payload).then((res) => {
    const d = res.data;
    setTokens(d.access_token, d.refresh_token);
    return d;
  });

export const refresh = (payload) =>
  client.post('/api/auth/refresh', payload).then((res) => {
    const d = res.data;
    setTokens(d.access_token, d.refresh_token);
    return d;
  });

export const me = () => client.get('/api/auth/me').then((res) => res.data);

export const updatePassword = (payload) =>
  client.put('/api/auth/password', payload).then((res) => res.data);

export const forgotPassword = (payload) =>
  client.post('/api/auth/forgot-password', payload).then((res) => res.data);

export const resetPassword = (payload) =>
  client.post('/api/auth/reset-password', payload).then((res) => res.data);
