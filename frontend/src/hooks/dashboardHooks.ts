import { useQuery } from '@tanstack/react-query';

export type DashboardMetrics = {
  fraudAlertsToday: number;
  amountAtRisk: number;
  casesResolved: number;
  detectionRate: number;
};

export type Transaction = {
  id?: string;
  txnId?: string;
  amount: number;
  risk: string;
  score: number;
  status: string;
};

export type FraudByTypeItem = {
  type: string;
  count: number;
  percentage: number;
};

export type VolumeHourlyPoint = {
  hour: string;
  volume: number;
  fraudRate: number;
};

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => getJSON<DashboardMetrics>('/api/dashboard/metrics'),
  });
}

export function useRecentTransactions(limit = 5) {
  return useQuery({
    queryKey: ['transactions', 'recent', limit],
    queryFn: () =>
      getJSON<Transaction[]>(`/api/transactions/recent?limit=${limit}`),
  });
}

export function useFraudByType() {
  return useQuery({
    queryKey: ['analytics', 'fraud-by-type'],
    queryFn: () => getJSON<FraudByTypeItem[]>('/api/analytics/fraud-by-type'),
  });
}

export function useVolumeChart() {
  return useQuery({
    queryKey: ['analytics', 'volume-hourly'],
    queryFn: () => getJSON<VolumeHourlyPoint[]>('/api/analytics/volume-hourly'),
  });
}
