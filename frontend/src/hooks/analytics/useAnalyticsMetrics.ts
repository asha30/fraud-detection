import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';

export default function useAnalyticsMetrics(range: string) {
  return useQuery({
    queryKey: ['analytics', 'metrics', range],
    queryFn: () => analyticsService.getMetrics(range),
  });
}
