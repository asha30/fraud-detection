import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';

export default function useMonthlyData(range: string) {
  return useQuery({
    queryKey: ['analytics', 'monthly-fraud', range],
    queryFn: () => analyticsService.getMonthlyFraud(range),
  });
}
