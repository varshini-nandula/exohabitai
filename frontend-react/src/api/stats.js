import client from './client';

export const statsAPI = {
  getStats: () =>
    client.get('/stats'),

  getHealth: () =>
    client.get('/health'),

  getRetrainingStatus: () =>
    client.get('/retraining_status'),
};
