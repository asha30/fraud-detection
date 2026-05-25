export type AdminUserRole =
  | 'Admin'
  | 'Fraud Analyst'
  | 'Risk Reviewer'
  | 'Compliance Officer'
  // backward compatibility if backend still sends older values
  | 'Senior Analyst'
  | 'Investigator'
  | 'ML Engineer'
  | 'Viewer';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  status: 'active' | 'inactive';
  lastLogin?: string;
};

export type ModelInfo = {
  id: string;
  model: string;
  version: string;
  type: string;
  precision: number;
  auc: number;
  deployed: boolean;
  active: boolean;
  lastTrained?: string;
};

export type RuleAction = 'block' | 'flag' | 'review' | 'alert';

export type RuleInfo = {
  id: string;
  name: string;
  condition: string;
  action: RuleAction;
  triggeredToday: number;
  active: boolean;
};

export type AdminMetrics = {
  totalUsers: number;
  activeAnalysts: number;
  activeModels: number;
  activeRules: number;
};

// Backward compatible exports (older code may still import these names)
export type AdminModel = ModelInfo;
export type AdminRule = RuleInfo;
