import client from './client';

export const planetsAPI = {
  // Returns the authenticated user's own submissions (with moderation status).
  getMySubmissions: () =>
    client.get('/my_planets'),
};
