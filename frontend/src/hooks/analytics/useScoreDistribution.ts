import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService';

export default function useScoreDistribution(range: string) {
  return useQuery({
    queryKey: ['analytics', 'score-distribution', range],
    queryFn: () => analyticsService.getScoreDistribution(range),
  });
}
