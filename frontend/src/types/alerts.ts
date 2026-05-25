export type AlertSeverity = 'critical' | 'warning' | 'info';

export type Alert = {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  type?: string;
  location?: string;
  model?: string;
  createdAt: string;
};

export type AlertsResponse = {
  alerts: Alert[];
  total: number;
  unread: number;
};

export type AlertsQuery = {
  status?: 'open' | 'resolved' | string;
  severity?: AlertSeverity | 'all';
  page?: number;
  limit?: number;
  search?: string;
};

export type AlertDetail = Alert & {
  timeline?: { at: string; message: string }[];
  relatedTransactions?: {
    transactionId: string;
    amount?: number;
    status?: string;
    riskScore?: number;
  }[];
  assignedTo?: string;
  notes?: { id: string; at: string; by: string; text: string }[];
};
