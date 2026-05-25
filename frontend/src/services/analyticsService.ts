import { apiGet } from './api';
import type {
  AnalyticsMetrics,
  MonthlyFraudPoint,
  ModelPerformance,
  ScoreDistributionPoint,
} from '../types/analytics';

export const analyticsService = {
  getMetrics: (range: string) => apiGet<AnalyticsMetrics>(`/analytics/metrics?range=${encodeURIComponent(range)}`),
  getMonthlyFraud: (range: string) => apiGet<MonthlyFraudPoint[]>(`/analytics/monthly-fraud?range=${encodeURIComponent(range)}`),
  getModelPerformance: () => apiGet<ModelPerformance>('/analytics/model-performance'),
  getScoreDistribution: (range: string) =>
    apiGet<ScoreDistributionPoint[]>(`/analytics/score-distribution?range=${encodeURIComponent(range)}`),
};
