import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../../services/dashboardService';

export default function useVolumeChart() {
  return useQuery({
    queryKey: ['analytics', 'volume-hourly'],
    queryFn: () => dashboardService.getVolumeHourly(),
  });
}
