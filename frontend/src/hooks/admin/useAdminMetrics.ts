import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/adminService';
import type { AdminMetrics } from '../../types/admin';

export function useAdminMetrics() {
  return useQuery<AdminMetrics>({
    queryKey: ['admin', 'metrics'],
    queryFn: () => adminService.getMetrics(),
  });
}
