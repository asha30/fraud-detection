import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  DollarSign,
  Percent,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageWrapper from '../components/PageWrapper';
import { useLiveStreamStore } from '../stores/useLiveStreamStore';

const TYPE_LABELS: Record<string, string> = {
  PAYMENT: 'Payment',
  TRANSFER: 'Transfer',
  CASH_OUT: 'Cash Out',
  CASH_IN: 'Cash In',
  DEBIT: 'Debit',
};

const TYPE_COLORS: Record<string, string> = {
  PAYMENT: '#378ADD',
  TRANSFER: '#E24B4A',
  CASH_OUT: '#EF9F27',
  CASH_IN: '#1D9E75',
  DEBIT: '#888780',
};

function scoreColor(score: number) {
  if (score >= 70) return '#E24B4A';
  if (score >= 40) return '#EF9F27';
  return '#1D9E75';
}

function fakeTxnId(round: number, index: number) {
  return `TXN-${String(round).padStart(2, '0')}${String(index).padStart(3, '0')}`;
}

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

const tooltipStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  fontSize: 12,
};

export default function DashboardPage() {
  const { transactions, stats } = useLiveStreamStore();

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const fraudRate = stats.total > 0 ? Math.round((stats.fraud / stats.total) * 100) : 0;

  // Amount of fraud-flagged transactions = "protected" (blocked)
  const amountProtected = useMemo(() => {
    return transactions
      .filter((t) => t.prediction === 'FRAUD')
      .reduce((sum, t) => sum + t.raw.amount, 0);
  }, [transactions]);

  // Fraud trend: group by 1-minute bucket
  const trendData = useMemo(() => {
    if (transactions.length === 0) return [];
    const buckets: Record<string, { total: number; fraud: number }> = {};
    for (const tx of transactions) {
      const d = new Date(tx.receivedAt);
      const key = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      if (!buckets[key]) buckets[key] = { total: 0, fraud: 0 };
      buckets[key].total++;
      if (tx.prediction === 'FRAUD') buckets[key].fraud++;
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([hour, v]) => ({
        hour,
        volume: v.total,
        fraudRate: v.total > 0 ? Math.round((v.fraud / v.total) * 100) : 0,
      }));
  }, [transactions]);

  // Fraud by type donut
  const fraudByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tx of transactions.filter((t) => t.prediction === 'FRAUD')) {
      const label = TYPE_LABELS[tx.raw.type] ?? tx.raw.type;
      counts[label] = (counts[label] ?? 0) + 1;
    }
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    return Object.entries(counts).map(([type, count]) => ({
      type,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
  }, [transactions]);

  const recentTransactions = transactions.slice(0, 8);

  return (
    <PageWrapper>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-950">
              Fraud Monitoring Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Real-time transaction monitoring powered by live stream data.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/10 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> AI Engine Active
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/10 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
              <Activity className="h-3.5 w-3.5 text-sky-600" /> Live Monitoring
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/10 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
              <Target className="h-3.5 w-3.5 text-slate-700" /> XGBoost Model
            </span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="group rounded-xl border border-slate-900/10 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Fraud Rate</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{stats.total > 0 ? `${fraudRate}%` : '—'}</div>
                <div className="mt-1 text-xs text-slate-500">Of all transactions flagged</div>
              </div>
              <div className="rounded-lg bg-rose-50 p-2 text-rose-700 ring-1 ring-rose-100"><Percent className="h-4 w-4" /></div>
            </div>
          </div>

          <div className="group rounded-xl border border-slate-900/10 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Transactions Monitored</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{stats.total}</div>
                <div className="mt-1 text-xs text-slate-500">Scored by ML model</div>
              </div>
              <div className="rounded-lg bg-sky-50 p-2 text-sky-700 ring-1 ring-sky-100"><TrendingUp className="h-4 w-4" /></div>
            </div>
          </div>

          <div className="group rounded-xl border border-slate-900/10 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Active Alerts</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{stats.fraud}</div>
                <div className="mt-1 text-xs text-slate-500">Fraud predictions</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-800 ring-1 ring-amber-100"><AlertTriangle className="h-4 w-4" /></div>
            </div>
          </div>

          <div className="group rounded-xl border border-slate-900/10 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Amount at Risk</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(amountProtected)}
                </div>
                <div className="mt-1 text-xs text-slate-500">Fraud-flagged transactions</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 ring-1 ring-emerald-100"><DollarSign className="h-4 w-4" /></div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:items-start">
          {/* Fraud trend */}
          <section className="rounded-xl border border-slate-900/10 bg-white p-4 shadow-sm lg:col-span-2">
            <div>
              <div className="text-sm font-semibold text-slate-950">Fraud trend</div>
              <div className="mt-0.5 text-xs text-slate-500">Fraud rate % and transaction volume by minute</div>
            </div>
            <div className="mt-3 h-[200px] min-h-[200px] w-full">
              {trendData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData}>
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line yAxisId="right" type="monotone" dataKey="fraudRate" stroke="#E24B4A" strokeWidth={2} dot={{ r: 2 }} name="Fraud %" />
                    <Line type="monotone" dataKey="volume" stroke="#0EA5E9" strokeWidth={2} dot={false} opacity={0.5} name="Volume" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  {stats.total === 0 ? 'Waiting for stream data…' : 'Accumulating data for trend…'}
                </div>
              )}
            </div>
          </section>

          {/* Live alerts sidebar */}
          <aside className="rounded-xl border border-slate-900/10 bg-white p-4 shadow-sm">
            <div>
              <div className="text-sm font-semibold text-slate-950">Live alerts</div>
              <div className="mt-0.5 text-xs text-slate-500">Latest fraud detections</div>
            </div>
            <div className="mt-3 space-y-2">
              {transactions.filter((t) => t.prediction === 'FRAUD').slice(0, 4).map((t, idx) => (
                <div key={`${t.round}-${t.index}-alert-${idx}`} className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                      <ShieldAlert size={10} /> High Risk
                    </span>
                    <span className="text-[10px] text-slate-400">{timeAgo(t.receivedAt)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-700">
                    <span className="font-mono text-slate-900">{fakeTxnId(t.round, t.index)}</span> flagged — {Math.round(t.probability * 100)}% fraud score
                  </div>
                </div>
              ))}
              {transactions.filter((t) => t.prediction === 'FRAUD').length === 0 && (
                <div className="flex flex-col items-center justify-center gap-1 py-8 text-slate-400">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  <span className="text-xs">No fraud detected yet</span>
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Donut + Recent Transactions */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:items-start">
          {/* Fraud by type donut */}
          <section className="rounded-xl border border-slate-900/10 bg-white p-4 shadow-sm">
            <div>
              <div className="text-sm font-semibold text-slate-950">Fraud by type</div>
              <div className="mt-0.5 text-xs text-slate-500">Transaction type distribution</div>
            </div>
            <div className="mt-3 h-[200px] min-h-[200px] w-full">
              {fraudByType.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Pie data={fraudByType} dataKey="percentage" nameKey="type" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {fraudByType.map((d) => (
                        <Cell key={d.type} fill={TYPE_COLORS[Object.keys(TYPE_LABELS).find((k) => TYPE_LABELS[k] === d.type) ?? ''] ?? '#888780'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No fraud data yet
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
              {fraudByType.map((d) => {
                const typeKey = Object.keys(TYPE_LABELS).find((k) => TYPE_LABELS[k] === d.type) ?? '';
                return (
                  <div key={d.type} className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm" style={{ background: TYPE_COLORS[typeKey] ?? '#888780' }} />
                    <span className="text-slate-600">{d.type}</span>
                    <span className="text-slate-400">{d.percentage}%</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Recent transactions */}
          <section className="rounded-xl border border-slate-900/10 bg-white p-4 shadow-sm lg:col-span-2">
            <div>
              <div className="text-sm font-semibold text-slate-950">Recent transactions</div>
              <div className="mt-0.5 text-xs text-slate-500">Latest activity from stream</div>
            </div>
            <div className="mt-3 max-h-[280px] overflow-auto rounded-lg border border-slate-900/10">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="border-b border-slate-900/10 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">Txn ID</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Risk Score</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-400">
                        Waiting for live stream data…
                      </td>
                    </tr>
                  ) : (
                    recentTransactions.map((t, i) => {
                      const isFraud = t.prediction === 'FRAUD';
                      const pct = Math.round(t.probability * 100);
                      return (
                        <tr key={`${t.round}-${t.index}-${i}`} className="border-t border-slate-900/5 hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{fakeTxnId(t.round, t.index)}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                              {TYPE_LABELS[t.raw.type] ?? t.raw.type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(t.raw.amount)}
                          </td>
                          <td className="px-3 py-2 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: scoreColor(pct) }} />
                              </div>
                              <span className="w-7 text-right text-xs tabular-nums" style={{ color: scoreColor(pct) }}>{pct}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {isFraud ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                                <ShieldAlert size={10} /> Fraud
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                <ShieldCheck size={10} /> Clear
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-[11px] text-slate-400 whitespace-nowrap">
                            {timeAgo(t.receivedAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Model accuracy bar */}
        <div className="rounded-xl border border-slate-900/10 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <div className="text-sm font-semibold text-slate-950">Model Accuracy</div>
              <div className="text-xs text-slate-500">(correct predictions / total)</div>
            </div>
            <div className="text-lg font-semibold text-slate-950">{stats.total > 0 ? `${accuracy}%` : '—'}</div>
          </div>
          {stats.total > 0 && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${accuracy}%` }} />
            </div>
          )}
          <div className="mt-2 flex gap-4 text-xs text-slate-500">
            <span>Total: {stats.total}</span>
            <span>Fraud: {stats.fraud}</span>
            <span>Legit: {stats.legit}</span>
            <span>Correct: {stats.correct}</span>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
