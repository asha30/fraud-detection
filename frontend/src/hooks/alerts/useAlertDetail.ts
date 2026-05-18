import { useQuery } from '@tanstack/react-query';
import { alertsService } from '../../services/alertsService';
import type { AlertDetail } from '../../types/alerts';

export type { AlertDetail };

export function useAlertDetail(id: string | null) {
  return useQuery({
    queryKey: ['alert', { id }],
    queryFn: () => alertsService.detail(id as string),
    enabled: Boolean(id),
  });
}
