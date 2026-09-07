import { api } from './api';

// Top-level admin endpoints (/api/admin/auth/*, /api/admin/clients).
export const adminApi = api;

/**
 * Every realtor-scoped endpoint (buyers, spreadsheets, listings, automations,
 * runs, deliveries, overview) lives under /api/admin/clients/:realtorId/... -
 * this just prefixes paths so pages can call scoped.get('/buyers') etc.
 */
export function scopedApi(realtorId) {
  const base = `/api/admin/clients/${realtorId}`;
  return {
    get: (path) => api.get(`${base}${path}`),
    post: (path, body) => api.post(`${base}${path}`, body),
    patch: (path, body) => api.patch(`${base}${path}`, body),
    delete: (path) => api.delete(`${base}${path}`),
  };
}
