import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/adminService';
import type { AdminModel } from '../../types/admin';

export type MLModel = AdminModel;

export function useAdminModels() {
  return useQuery({
    queryKey: ['admin', 'models'],
    queryFn: () => adminService.listModels(),
  });
}
