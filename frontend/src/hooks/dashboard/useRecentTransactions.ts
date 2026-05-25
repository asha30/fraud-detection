import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../../services/dashboardService';
import type { RecentTransaction } from '../../types/dashboard';

// Dashboard page expects: { id, amount, risk, score, status }
export type Transaction = RecentTransaction;

export default function useRecentTransactions(limit = 5) {
  return useQuery({
    queryKey: ['dashboard', 'recent-transactions', { limit }],
    queryFn: async () => {
      const data = await dashboardService.getRecentTransactions(limit);
      // Map FastAPI schema -> UI schema
      return (data as any[]).map((t: any) => ({
        id: String(t.id ?? ''),
        amount: Number(t.amount ?? 0),
        risk:
          String(t.status ?? '').toLowerCase() === 'suspicious'
            ? 'high'
            : String(t.status ?? '').toLowerCase() === 'safe'
              ? 'safe'
              : 'low',
        score: Number(t.riskScore ?? 0),
        status: String(t.status ?? ''),
      })) as RecentTransaction[];
    },
  });
}
