import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../../services/dashboardService';

export default function useFraudByType() {
  return useQuery({
    queryKey: ['analytics', 'fraud-by-type'],
    queryFn: () => dashboardService.getFraudByType(),
  });
}
