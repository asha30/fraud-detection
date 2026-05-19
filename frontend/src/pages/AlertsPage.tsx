import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  Clock,
  Filter,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Timer,
  Users,
} from 'lucide-react';
import Badge from '../components/Badge';
import PageWrapper from '../components/PageWrapper';
import { useLiveStreamStore } from '../stores/useLiveStreamStore';
import type { LiveTransaction } from '../hooks/useLiveStream';

type RiskFilter = 'all' | 'high' | 'medium' | 'safe';
type SortKey = 'latest' | 'risk';

function fakeTxnId(round: number, index: number) {
  return `TXN-${String(round).padStart(2, '0')}${String(index).padStart(3, '0')}`;
}

function fakeCustomerId(seed: number) {
  const n = ((seed * 6364136223846793005 + 1442695040888963407) >>> 0) % 900000 + 100000;
  return `CUST-${n.toString().slice(-5)}`;
}

function formatMoney(amount: number) {
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

const TYPE_LABELS: Record<string, string> = {
  PAYMENT: 'Payment Fraud',
  TRANSFER: 'Wire Fraud',
  CASH_OUT: 'Cash Out Fraud',
  CASH_IN: 'Suspicious Deposit',
  DEBIT: 'Debit Fraud',
};

function riskFromProb(prob: number): 'high' | 'medium' | 'safe' {
  if (prob >= 0.7) return 'high';
  if (prob >= 0.4) return 'medium';
  return 'safe';
}

function riskLabel(risk: 'high' | 'medium' | 'safe') {
  if (risk === 'high') return 'High Risk';
  if (risk === 'medium') return 'Medium Risk';
  return 'Safe';
}

function Card({ title, value, subtext, icon: Icon }: { title: string; value: string; subtext: string; icon: React.ComponentType<any> }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-600">{title}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
          <div className="mt-1 text-xs text-slate-500">{subtext}</div>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

interface LLMSignal { name: string; severity: string; detail: string; }
interface LLMReport {
  fraud_report: {
    title: string;
    risk_level: string;
    confidence: string;
    what_happened: string;
    why_fraud: string;
    signals: LLMSignal[];
    recommended_action: string;
    alert_id: string;
    detected_at: string;
  };
  received_at: string;
}

function useLLMReports() {
  const [reports, setReports] = useState<LLMReport[]>([]);
  useEffect(() => {
    const fetch_ = () =>
      fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8002'}/alerts/llm-report`)
        .then(r => r.json())
        .then(setReports)
        .catch(() => {});
    fetch_();
    const id = setInterval(fetch_, 5000);
    return () => clearInterval(id);
  }, []);
  return reports;
}

function useTxInsight(round: number, index: number) {
  const [report, setReport] = useState<LLMReport | null>(null);
  useEffect(() => {
    setReport(null);
    const fetch_ = () =>
      fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8002'}/alerts/llm-report/${round}/${index}`)
        .then(r => r.json())
        .then(data => { if (data) setReport(data as LLMReport); })
        .catch(() => {});
    fetch_();
    const id = setInterval(fetch_, 5000);
    return () => clearInterval(id);
  }, [round, index]);
  return report;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-rose-50 border-rose-200 text-rose-700',
  HIGH:     'bg-orange-50 border-orange-200 text-orange-700',
  MEDIUM:   'bg-amber-50 border-amber-200 text-amber-700',
};

function AlertDetailPanel({ tx, onDismiss }: { tx: LiveTransaction; onDismiss: () => void }) {
  const pct = Math.round(tx.probability * 100);
  const risk = riskFromProb(tx.probability);
  const txnId = fakeTxnId(tx.round, tx.index);
  const customerId = fakeCustomerId(tx.index * 3 + tx.round);
  const fraudType = TYPE_LABELS[tx.raw.type] ?? 'Unknown Fraud';

  const llmReport = useTxInsight(tx.round, tx.index);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Alert details</div>
          <div className="mt-0.5 text-xs text-slate-500">{txnId}</div>
        </div>
        <Badge variant={risk === 'high' ? 'high' : risk === 'medium' ? 'medium' : 'safe'}>{riskLabel(risk)}</Badge>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-700">Fraud probability</div>
          <div className="mt-1 flex items-end justify-between">
            <div className="text-2xl font-semibold tracking-tight text-slate-900">{pct}%</div>
            <div className="text-xs text-slate-500">XGBoost score</div>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: risk === 'high' ? '#E24B4A' : risk === 'medium' ? '#EF9F27' : '#1D9E75' }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[11px] font-medium text-slate-500">Customer</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{customerId}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[11px] font-medium text-slate-500">Amount</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{formatMoney(tx.raw.amount)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[11px] font-medium text-slate-500">Fraud type</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{fraudType}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[11px] font-medium text-slate-500">Time</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{timeAgo(tx.receivedAt)}</div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-xs font-medium text-slate-700">Balance impact</div>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span>Sender balance change</span>
              <span className="font-mono">{formatMoney(tx.raw.newbalanceOrig - tx.raw.oldbalanceOrg)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Receiver balance change</span>
              <span className="font-mono">{formatMoney(tx.raw.newbalanceDest - tx.raw.oldbalanceDest)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-700">Recommended action</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {risk === 'high' ? 'Freeze Transaction' : risk === 'medium' ? 'Escalate for Review' : 'Review'}
          </div>
        </div>

        {/* LLM Insights */}
        {llmReport ? (
          <div className={`rounded-lg border p-3 space-y-3 ${(llmReport as any).source === 'model' ? 'border-slate-200 bg-slate-50' : 'border-violet-200 bg-violet-50'}`}>
            <div className="flex items-center gap-2">
              <Brain size={14} className={(llmReport as any).source === 'model' ? 'text-slate-500 shrink-0' : 'text-violet-600 shrink-0'} />
              <div className={`text-xs font-semibold ${(llmReport as any).source === 'model' ? 'text-slate-600' : 'text-violet-700'}`}>
                Fraud Insights
              </div>
              {(llmReport as any).source === 'model' ? (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  Model · AI processing…
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 border border-violet-200">
                  ✦ AI Agent
                </span>
              )}
              <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                {llmReport.fraud_report.confidence}
              </span>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-500 mb-1">What happened</div>
              <div className="text-xs text-slate-700 leading-relaxed">{llmReport.fraud_report.what_happened}</div>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-500 mb-1">Why it's fraud</div>
              <div className="text-xs text-slate-700 leading-relaxed">{llmReport.fraud_report.why_fraud}</div>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-500 mb-2">Risk signals</div>
              <div className="space-y-1.5">
                {llmReport.fraud_report.signals.map((s, i) => (
                  <div key={i} className={`flex items-start gap-2 rounded-md border px-2 py-1.5 text-xs ${SEVERITY_COLORS[s.severity] ?? 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <span className="font-bold shrink-0">{s.severity}</span>
                    <span>{s.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center gap-2 text-xs text-slate-400">
            <Brain size={13} />
            Waiting for AI insights…
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 pt-1">
          <button type="button" onClick={onDismiss}
            className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
            Mark Safe
          </button>
          <button type="button"
            className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100">
            Escalate
          </button>
          <button type="button"
            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100">
            Freeze Transaction
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { transactions, stats } = useLiveStreamStore();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('latest');

  // All fraud-flagged transactions not dismissed
  const fraudTxs = useMemo(() => {
    return transactions.filter((t) => t.prediction === 'FRAUD');
  }, [transactions]);

  const activeFraud = useMemo(() => {
    return fraudTxs.filter((t) => !dismissed.has(`${t.round}-${t.index}`));
  }, [fraudTxs, dismissed]);

  const highRisk = activeFraud.filter((t) => riskFromProb(t.probability) === 'high');
  const resolvedCount = dismissed.size;

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = activeFraud.filter((t) => {
      const risk = riskFromProb(t.probability);
      if (riskFilter !== 'all' && risk !== riskFilter) return false;
      if (!q) return true;
      const txnId = fakeTxnId(t.round, t.index).toLowerCase();
      const custId = fakeCustomerId(t.index * 3 + t.round).toLowerCase();
      const type = (TYPE_LABELS[t.raw.type] ?? t.raw.type).toLowerCase();
      return txnId.includes(q) || custId.includes(q) || type.includes(q);
    });
    if (sortKey === 'risk') list = [...list].sort((a, b) => b.probability - a.probability);
    return list;
  }, [activeFraud, query, riskFilter, sortKey]);

  const selectedTx = useMemo(() => {
    if (!selectedKey) return filteredSorted[0] ?? null;
    return transactions.find((t) => `${t.round}-${t.index}` === selectedKey) ?? filteredSorted[0] ?? null;
  }, [selectedKey, filteredSorted, transactions]);

  function dismiss(tx: LiveTransaction) {
    setDismissed((prev) => new Set([...prev, `${tx.round}-${tx.index}`]));
    setSelectedKey(null);
  }

  return (
    <PageWrapper>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-lg font-semibold text-slate-900">Alert Monitoring</div>
            <div className="mt-0.5 text-sm text-slate-600">Real-time fraud alerts from live stream</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live Monitoring Active
            </span>
            <div className="relative">
              <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
                className="h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:ring-2 focus:ring-emerald-200">
                <option value="all">All risk levels</option>
                <option value="high">High risk</option>
                <option value="medium">Medium risk</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card title="Active Alerts" value={String(activeFraud.length)} subtext="Open fraud cases" icon={Siren} />
          <Card title="High Risk Cases" value={String(highRisk.length)} subtext="Escalation recommended" icon={AlertTriangle} />
          <Card title="Resolved" value={String(resolvedCount)} subtext="Marked safe / dismissed" icon={Activity} />
          <Card title="Total Monitored" value={String(stats.total)} subtext="All stream transactions" icon={Timer} />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
          {/* Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold text-slate-900">
                Fraud Alerts <span className="ml-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">{activeFraud.length}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search txn ID, customer, type…"
                    className="h-9 w-[240px] max-w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-200" />
                </div>
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:ring-2 focus:ring-emerald-200">
                  <option value="latest">Sort: Latest</option>
                  <option value="risk">Sort: Highest risk</option>
                </select>
              </div>
            </div>

            {filteredSorted.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center">
                <div className="flex flex-col items-center gap-2 px-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <Shield size={18} />
                  </div>
                  <div className="text-sm font-semibold text-slate-900">No active fraud alerts</div>
                  <div className="text-xs text-slate-500">
                    {stats.total === 0 ? 'Waiting for live stream data…' : 'All transactions clear in selected filter.'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Alert ID</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fraud Type</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Risk Score</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSorted.map((t) => {
                      const key = `${t.round}-${t.index}`;
                      const isSelected = (selectedKey ?? filteredSorted[0]?.round + '-' + filteredSorted[0]?.index) === key;
                      const risk = riskFromProb(t.probability);
                      const pct = Math.round(t.probability * 100);
                      return (
                        <tr key={key} onClick={() => setSelectedKey(key)}
                          className={`cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 ${isSelected ? 'bg-emerald-50/60' : ''}`}>
                          <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900">{fakeTxnId(t.round, t.index)}</td>
                          <td className="px-4 py-3 text-slate-700">{fakeCustomerId(t.index * 3 + t.round)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{formatMoney(t.raw.amount)}</td>
                          <td className="px-4 py-3 text-slate-700">{TYPE_LABELS[t.raw.type] ?? t.raw.type}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: risk === 'high' ? '#E24B4A' : risk === 'medium' ? '#EF9F27' : '#1D9E75' }} />
                              </div>
                              <span className="text-xs tabular-nums text-slate-700">{pct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={risk === 'high' ? 'high' : risk === 'medium' ? 'medium' : 'safe'}>
                              {riskLabel(risk)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{timeAgo(t.receivedAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900">Analyst Panel</div>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Users size={14} className="text-slate-400" /> Fraud Ops
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <Clock size={14} className="text-slate-400" />
                <span>Click a row to review. Take action below.</span>
              </div>
            </div>

            {selectedTx ? (
              <AlertDetailPanel tx={selectedTx} onDismiss={() => dismiss(selectedTx)} />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-200">
                    <Shield size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {stats.total === 0 ? 'No stream data yet' : 'No fraud alerts'}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {stats.total === 0 ? 'Waiting for live stream to start.' : 'All transactions currently clear.'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {stats.total > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[12px] font-semibold text-slate-700 mb-3">Stream Summary</div>
                <div className="space-y-2 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total scored</span>
                    <span className="font-semibold text-slate-900">{stats.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fraud flagged</span>
                    <span className="font-semibold text-rose-700">{stats.fraud}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Legitimate</span>
                    <span className="font-semibold text-emerald-700">{stats.legit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Model accuracy</span>
                    <span className="font-semibold text-slate-900">
                      {Math.round((stats.correct / stats.total) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldAlert size={13} className="text-rose-400" />
          Fraud alerts sourced from live XGBoost stream · refreshes automatically
        </div>
      </div>
    </PageWrapper>
  );
}
