import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../../services/dashboardService';

export default function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => dashboardService.getMetrics(),
  });
}
