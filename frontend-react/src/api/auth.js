import client from './client';

export const authAPI = {
  login: (username, password) =>
    client.post('/auth/login', { username, password }),

  register: (username, email, password) =>
    client.post('/auth/register', { username, email, password }),

  getProfile: () =>
    client.get('/auth/me'),

  updateProfile: (data) =>
    client.put('/auth/me', data),

  logout: () =>
    client.post('/auth/logout'),
};
