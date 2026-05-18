import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';

export default function useModelPerformance() {
  return useQuery({
    queryKey: ['analytics', 'model-performance'],
    queryFn: () => analyticsService.getModelPerformance(),
  });
}
