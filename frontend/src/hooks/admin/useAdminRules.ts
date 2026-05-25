import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/adminService';
import type { AdminRule, RuleAction } from '../../types/admin';

export type Rule = AdminRule;
export type { RuleAction };

export function useAdminRules() {
  return useQuery({
    queryKey: ['admin', 'rules'],
    queryFn: () => adminService.listRules(),
  });
}
