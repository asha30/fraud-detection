import { useQuery } from '@tanstack/react-query';
import { alertsService } from '../../services/alertsService';
import type { Alert, AlertSeverity, AlertsResponse } from '../../types/alerts';

export type { Alert, AlertSeverity, AlertsResponse };

export function useAlerts(severity: AlertSeverity | 'all') {
  return useQuery({
    queryKey: ['alerts', { severity }],
    queryFn: () =>
      alertsService.list({
        status: 'open',
        severity,
        page: 1,
        limit: 50,
      }),
  });
}
