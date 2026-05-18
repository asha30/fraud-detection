import { apiGet, apiSend } from './api';
import type { AdminMetrics, ModelInfo, RuleInfo, AdminUser } from '../types/admin';

export const adminService = {
  // FastAPI
  getStats: () => apiGet<AdminMetrics>('/admin/metrics'),
  // Backwards compatible
  getMetrics: () => apiGet<AdminMetrics>('/admin/metrics'),

  listUsers: () => apiGet<AdminUser[]>('/admin/users'),
  createUser: (payload: Omit<AdminUser, 'id'>) => apiSend<AdminUser>('/admin/users', 'POST', payload),
  updateUser: (id: string, payload: Omit<AdminUser, 'id'>) => apiSend<AdminUser>(`/admin/users/${encodeURIComponent(id)}`, 'PUT', payload),
  deleteUser: (id: string) => apiSend<void>(`/admin/users/${encodeURIComponent(id)}`, 'DELETE'),

  listModels: () => apiGet<ModelInfo[]>('/admin/models'),
  retrainModel: (id: string) => apiSend<void>(`/admin/models/${encodeURIComponent(id)}/retrain`, 'POST'),
  deployModel: (id: string) => apiSend<void>(`/admin/models/${encodeURIComponent(id)}/deploy`, 'POST'),
  disableModel: (id: string) => apiSend<void>(`/admin/models/${encodeURIComponent(id)}/disable`, 'POST'),

  listRules: () => apiGet<RuleInfo[]>('/admin/rules'),
  createRule: (payload: Omit<RuleInfo, 'id'>) => apiSend<RuleInfo>('/admin/rules', 'POST', payload),
  updateRule: (id: string, payload: Omit<RuleInfo, 'id'>) => apiSend<RuleInfo>(`/admin/rules/${encodeURIComponent(id)}`, 'PUT', payload),
};
