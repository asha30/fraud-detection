export type DashboardMetrics = {
  fraudAlertsToday: number;
  amountAtRisk: number;
  casesResolved: number;
  detectionRate: number;
};

export type FraudByTypeDatum = {
  type: string;
  count: number;
  percentage: number;
};

export type VolumeHourlyDatum = {
  hour: string;
  volume: number;
  fraudRate: number;
};

export type RiskLevel = 'high' | 'medium' | 'low' | 'safe';

export type RecentTransaction = {
  id: string;
  amount: number;
  risk: RiskLevel;
  score: number;
  status: string;
};
