import client from './client';

export const planetsAPI = {
  addPlanet: (data) =>
    client.post('/add_planet', data),
};
