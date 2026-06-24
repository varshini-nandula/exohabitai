import client from './client';

export const predictionAPI = {
  predict: (data) =>
    client.post('/predict', data),

  predictAndStore: (data) =>
    client.post('/predict_and_store', data),
};
