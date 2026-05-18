export type AnalyticsMetrics = {
  totalTransactions: number;
  fraudRate: number;
  avgResolutionHours: number;
  falsePositiveRate: number;
};

export type MonthlyFraudPoint = {
  month: string;
  losses: number;
  prevented: number;
};

export type ModelPerformance = {
  precision: number; // percent 0-100
  recall: number; // percent 0-100
  f1: number; // percent 0-100
  auc: number; // 0-1 OR 0-100
};

export type ScoreDistributionPoint = {
  bucket: string;
  count: number;
};
