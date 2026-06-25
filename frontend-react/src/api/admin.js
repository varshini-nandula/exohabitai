/**
 * ExoHabitAI — Admin API Module
 * ================================
 * Single API module for all admin control plane endpoints.
 * Every call goes through the shared Axios client (JWT interceptor).
 *
 * Follows the pattern from auth.js / stats.js / planets.js.
 */

import client from './client';

export const adminAPI = {
  // ─── Dashboard ──────────────────────────────────────────────────
  getDashboard: () =>
    client.get('/admin/dashboard'),

  // ─── Moderation ─────────────────────────────────────────────────
  getPendingPlanets: (page = 1, perPage = 20) =>
    client.get(`/admin/planets/pending?page=${page}&per_page=${perPage}`),

  getAllPlanets: (params = {}) =>
    client.get('/admin/planets/all', { params }),

  getPlanetDetail: (id) =>
    client.get(`/admin/planets/${id}`),

  approvePlanet: (id) =>
    client.post(`/admin/planets/${id}/approve`),

  rejectPlanet: (id, reason = '') =>
    client.post(`/admin/planets/${id}/reject`, { reason }),

  // ─── Users ──────────────────────────────────────────────────────
  getUsers: (params = {}) =>
    client.get('/admin/users', { params }),

  getUserDetail: (id) =>
    client.get(`/admin/users/${id}`),

  activateUser: (id) =>
    client.post(`/admin/users/${id}/activate`),

  deactivateUser: (id) =>
    client.post(`/admin/users/${id}/deactivate`),

  promoteUser: (id) =>
    client.post(`/admin/users/${id}/promote`),

  demoteUser: (id) =>
    client.post(`/admin/users/${id}/demote`),

  // ─── Datasets ───────────────────────────────────────────────────
  uploadDataset: (formData) =>
    client.post('/admin/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getDatasets: () =>
    client.get('/admin/datasets'),

  getDatasetDetail: (id) =>
    client.get(`/admin/datasets/${id}`),

  validateDataset: (id) =>
    client.post(`/admin/datasets/${id}/validate`),

  markDatasetReady: (id) =>
    client.post(`/admin/datasets/${id}/ready`),

  deleteDataset: (id) =>
    client.delete(`/admin/datasets/${id}`),

  // ─── Models ─────────────────────────────────────────────────────
  getModels: () =>
    client.get('/admin/models'),

  getActiveModel: () =>
    client.get('/admin/models/active'),

  getModelDetail: (id) =>
    client.get(`/admin/models/${id}`),

  // ─── Retraining ─────────────────────────────────────────────────
  startRetraining: (datasetId = null, reason = '') =>
    client.post('/admin/retraining/start', {
      dataset_id: datasetId,
      reason,
    }),

  getRetrainingStatus: () =>
    client.get('/admin/retraining/status'),

  getRetrainingLogs: (limit = 20) =>
    client.get(`/admin/retraining/logs?limit=${limit}`),
};
