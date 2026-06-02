import client from './client';

export const rankingsAPI = {
  getRankings: (limit = 'all') =>
    client.get('/rank', { params: { limit } }),
};
