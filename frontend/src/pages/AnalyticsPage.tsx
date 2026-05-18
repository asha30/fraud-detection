import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageWrapper from '../components/PageWrapper';
import { Activity, AlertTriangle, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { useLiveStreamStore } from '../stores/useLiveStreamStore';

type RangeKey = '1m' | '5m' | '30m' | 'all';

function ModelMetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{safe.toFixed(1)}%</div>
      </div>
      <div style={{ height: 7, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <div style={{ height: '100%', width: `${safe}%`, background: color }} />
      </div>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.10)',
  fontSize: 12,
};

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

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('all');
  const { transactions, stats } = useLiveStreamStore();

  const now = Date.now();
  const cutoff: Record<RangeKey, number> = {
    '1m': now - 60_000,
    '5m': now - 300_000,
    '30m': now - 1_800_000,
    all: 0,
  };

  const filtered = useMemo(() => {
    const c = cutoff[range];
    return c === 0 ? transactions : transactions.filter((t) => t.receivedAt >= c);
  }, [transactions, range]);

  const filteredStats = useMemo(() => {
    const total = filtered.length;
    const fraud = filtered.filter((t) => t.prediction === 'FRAUD').length;
    const legit = total - fraud;
    const correct = filtered.filter((t) => t.prediction === t.label).length;
    return { total, fraud, legit, correct };
  }, [filtered]);

  const fraudRate = filteredStats.total > 0 ? ((filteredStats.fraud / filteredStats.total) * 100).toFixed(1) : '0';
  const accuracy = filteredStats.total > 0 ? Math.round((filteredStats.correct / filteredStats.total) * 100) : 0;

  // False positive: predicted FRAUD but label was LEGIT
  const fp = filtered.filter((t) => t.prediction === 'FRAUD' && t.label === 'LEGIT').length;
  const fpRate = filteredStats.total > 0 ? ((fp / filteredStats.total) * 100).toFixed(1) : '0';

  // Transaction type bar chart
  const typeData = useMemo(() => {
    const counts: Record<string, { total: number; fraud: number }> = {};
    for (const tx of filtered) {
      const label = TYPE_LABELS[tx.raw.type] ?? tx.raw.type;
      if (!counts[label]) counts[label] = { total: 0, fraud: 0 };
      counts[label].total++;
      if (tx.prediction === 'FRAUD') counts[label].fraud++;
    }
    return Object.entries(counts).map(([type, v]) => ({ type, ...v }));
  }, [filtered]);

  // Score distribution: bucket probabilities 0-9, 10-19, ... 90-99
  const distData = useMemo(() => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      bucket: `${i * 10}–${i * 10 + 9}%`,
      count: 0,
    }));
    for (const tx of filtered) {
      const idx = Math.min(9, Math.floor(tx.probability * 10));
      buckets[idx].count++;
    }
    return buckets;
  }, [filtered]);

  // Model performance derived from stream
  const tp = filtered.filter((t) => t.prediction === 'FRAUD' && t.label === 'FRAUD').length;
  const tn = filtered.filter((t) => t.prediction === 'LEGIT' && t.label === 'LEGIT').length;
  const fn = filtered.filter((t) => t.prediction === 'LEGIT' && t.label === 'FRAUD').length;
  const precision = (tp + fp) > 0 ? (tp / (tp + fp)) * 100 : 0;
  const recall = (tp + fn) > 0 ? (tp / (tp + fn)) * 100 : 0;
  const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const rangeButtons: { key: RangeKey; label: string }[] = [
    { key: '1m', label: '1 Min' },
    { key: '5m', label: '5 Min' },
    { key: '30m', label: '30 Min' },
    { key: 'all', label: 'All' },
  ];

  return (
    <PageWrapper>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-[18px] font-semibold text-slate-900 leading-tight">Analytics</h1>
          <p className="text-[12px] text-slate-600 mt-1">Live stream metrics, model performance, and risk distribution.</p>
        </div>
        <div className="inline-flex gap-2">
          {rangeButtons.map((b) => {
            const active = b.key === range;
            return (
              <button key={b.key} type="button" onClick={() => setRange(b.key)}
                className={"rounded-lg px-3 py-2 text-[12px] font-medium border transition-colors " +
                  (active ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-white")}>
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 hover:shadow-md transition-shadow flex">
          <div className="flex-1">
            <div className="text-[12px] text-slate-600">Total Transactions</div>
            <div className="text-[22px] font-semibold text-slate-900 mt-1">{filteredStats.total}</div>
            <div className="text-[11px] text-slate-500 mt-1">In selected window</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 hover:shadow-md transition-shadow flex">
          <div className="flex-1">
            <div className="text-[12px] text-slate-600">Fraud Rate</div>
            <div className="text-[22px] font-semibold text-slate-900 mt-1">{fraudRate}%</div>
            <div className="text-[11px] text-slate-500 mt-1">Lower is better</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 hover:shadow-md transition-shadow flex">
          <div className="flex-1">
            <div className="text-[12px] text-slate-600">Model Accuracy</div>
            <div className="text-[22px] font-semibold text-slate-900 mt-1">{filteredStats.total > 0 ? `${accuracy}%` : '—'}</div>
            <div className="text-[11px] text-slate-500 mt-1">Correct vs actual label</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-700">
            <Zap className="w-4 h-4" />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3 hover:shadow-md transition-shadow flex">
          <div className="flex-1">
            <div className="text-[12px] text-slate-600">False Positive Rate</div>
            <div className="text-[22px] font-semibold text-slate-900 mt-1">{fpRate}%</div>
            <div className="text-[11px] text-slate-500 mt-1">Legitimate flagged as fraud</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-700">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3 items-start">
        {/* Transaction type bar chart */}
        <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-slate-900">Transactions by Type</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Total and fraud count per transaction type</div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-700">
              <div className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-sky-300" /> Total</div>
              <div className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Fraud</div>
            </div>
          </div>
          <div className="mt-3 h-[240px] min-h-[240px] w-full">
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} barCategoryGap={14} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} contentStyle={tooltipStyle} labelStyle={{ color: '#0f172a', fontWeight: 600 }} />
                  <Bar dataKey="total" fill="#7DD3FC" radius={[6, 6, 0, 0]} name="Total" />
                  <Bar dataKey="fraud" fill="#F87171" radius={[6, 6, 0, 0]} name="Fraud" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                {stats.total === 0 ? 'Waiting for stream data…' : 'No data in this time window'}
              </div>
            )}
          </div>
        </section>

        {/* Model Performance */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold text-slate-900">Model Performance</div>
              <div className="text-[11px] text-slate-500 mt-0.5">XGBoost · live stream</div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              <ShieldCheck className="w-3.5 h-3.5" /> Live
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {filteredStats.total > 0 ? (
              <>
                <ModelMetricBar label="Accuracy" value={accuracy} color="#1D9E75" />
                <ModelMetricBar label="Precision" value={precision} color="#378ADD" />
                <ModelMetricBar label="Recall" value={recall} color="#EF9F27" />
                <ModelMetricBar label="F1 Score" value={f1} color="#7F77DD" />
              </>
            ) : (
              <div className="text-[12px] text-slate-400">Waiting for stream data…</div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
              <div className="text-slate-500">True Positives</div>
              <div className="font-semibold text-slate-900">{tp}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
              <div className="text-slate-500">True Negatives</div>
              <div className="font-semibold text-slate-900">{tn}</div>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50 p-2">
              <div className="text-rose-600">False Positives</div>
              <div className="font-semibold text-rose-800">{fp}</div>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-2">
              <div className="text-amber-700">False Negatives</div>
              <div className="font-semibold text-amber-900">{fn}</div>
            </div>
          </div>
        </section>
      </div>

      {/* Score Distribution */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-slate-900">Risk Score Distribution</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Fraud probability buckets across all transactions</div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-700">
            <div className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Low</div>
            <div className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Medium</div>
            <div className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> High</div>
          </div>
        </div>
        <div className="mt-3 h-[170px] min-h-[170px] w-full">
          {filteredStats.total > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} contentStyle={tooltipStyle} labelStyle={{ color: '#0f172a', fontWeight: 600 }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Count">
                  {distData.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={idx <= 3 ? '#5DCAA5' : idx <= 5 ? '#EF9F27' : '#E24B4A'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              {stats.total === 0 ? 'Waiting for stream data…' : 'No data in this time window'}
            </div>
          )}
        </div>
      </section>
    </PageWrapper>
  );
}
