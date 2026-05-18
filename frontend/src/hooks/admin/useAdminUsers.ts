import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/adminService';
import type { AdminUser, AdminUserRole } from '../../types/admin';

export type { AdminUser, AdminUserRole };

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminService.listUsers(),
  });
}
