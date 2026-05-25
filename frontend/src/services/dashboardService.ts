import { apiGet } from './api';
import type {
  DashboardMetrics,
  FraudByTypeDatum,
  RecentTransaction,
  VolumeHourlyDatum,
} from '../types/dashboard';

export const dashboardService = {
  // FastAPI dashboard
  getStats: () => apiGet<DashboardMetrics>('/dashboard/metrics'),
  // Backwards compatible name used across hooks/components
  getMetrics: () => apiGet<DashboardMetrics>('/dashboard/metrics'),

  // Dashboard trends
  // FastAPI: /dashboard/fraud-trends (daily points)
  getTrend: (days: number = 14) =>
    apiGet<any[]>(`/dashboard/fraud-trends?days=${encodeURIComponent(String(days))}`),

  // Keep existing (if backend provides these elsewhere)
  getRecentTransactions: (limit: number) =>
    apiGet<RecentTransaction[]>(`/transactions/recent?limit=${encodeURIComponent(String(limit))}`),
  getFraudByType: () => apiGet<FraudByTypeDatum[]>('/analytics/fraud-by-type'),
  getVolumeHourly: () => apiGet<VolumeHourlyDatum[]>('/analytics/volume-hourly'),
};
