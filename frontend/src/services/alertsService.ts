import { apiGet, apiSend } from './api';
import type { AlertDetail, AlertsQuery, AlertsResponse } from '../types/alerts';

export const alertsService = {
  // FastAPI endpoints
  live: (limit: number = 25) =>
    apiGet<any[]>(`/alerts/live?limit=${encodeURIComponent(String(limit))}`),
  history: (limit: number = 100) =>
    apiGet<any[]>(`/alerts/history?limit=${encodeURIComponent(String(limit))}`),

  // Backwards compatible methods (if older UI calls exist)
  list: (query: AlertsQuery) => {
    const params = new URLSearchParams();
    if (query.status) params.set('status', query.status);
    if (query.severity && query.severity !== 'all') params.set('severity', query.severity);
    if (query.page != null) params.set('page', String(query.page));
    if (query.limit != null) params.set('limit', String(query.limit));
    if (query.search) params.set('search', query.search);
    return apiGet<AlertsResponse>(`/alerts?${params.toString()}`);
  },
  detail: (id: string) => apiGet<AlertDetail>(`/alerts/${encodeURIComponent(id)}`),
  markSafe: (id: string) => apiSend<void>(`/alerts/${encodeURIComponent(id)}/safe`, 'POST'),
  escalate: (id: string) => apiSend<void>(`/alerts/${encodeURIComponent(id)}/escalate`, 'POST'),
  freeze: (id: string) => apiSend<void>(`/alerts/${encodeURIComponent(id)}/freeze`, 'POST'),
};
