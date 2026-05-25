import { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ShieldAlert, ShieldCheck,
  Wifi, WifiOff, Zap, Bell, Trash2, Search, ChevronRight,
} from 'lucide-react';
import PageWrapper from '../components/PageWrapper';
import useLiveStream, { type LiveTransaction } from '../hooks/useLiveStream';
import TransactionDrawer from '../components/TransactionDrawer';

/* ── helpers ──────────────────────────────────────────────────── */

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'connected' ? '#1D9E75'
    : status === 'connecting' ? '#EF9F27'
    : '#E24B4A';
  const label =
    status === 'connected' ? 'Live'
    : status === 'connecting' ? 'Connecting…'
    : status === 'error' ? 'Error'
    : 'Paused';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }}>
        {status === 'connected' && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />
        )}
      </span>
      {label}
    </span>
  );
}

function ProbBar({ prob }: { prob: number }) {
  const pct = Math.round(prob * 100);
  const color = pct >= 50 ? '#E24B4A' : pct >= 25 ? '#EF9F27' : '#1D9E75';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-8 text-right text-xs tabular-nums font-medium" style={{ color }}>{pct}%</span>
    </div>
  );
}

function GraphBadges({ graph }: { graph: LiveTransaction['graph'] }) {
  if (!graph) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {graph.kyc_ssn_reuse >= 2 && (
        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700">SSN ×{graph.kyc_ssn_reuse}</span>
      )}
      {!graph.kyc_email_match && (
        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-orange-100 text-orange-700">Email ✗</span>
      )}
      {graph.kyc_phone_reuse >= 2 && (
        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-yellow-100 text-yellow-700">Phone ×{graph.kyc_phone_reuse}</span>
      )}
      {graph.d1_days < 5 && (
        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 text-purple-700">D1:{graph.d1_days.toFixed(0)}d</span>
      )}
      <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500">{graph.device_type}</span>
    </div>
  );
}

// Deterministic fake account number from transaction index
function fakeAccount(seed: number, prefix: string) {
  const n = ((seed * 6364136223846793005 + 1442695040888963407) >>> 0) % 900000 + 100000;
  return `${prefix}••••${n.toString().slice(-4)}`;
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

const TYPE_LABELS: Record<string, string> = {
  PAYMENT: 'Payment',
  TRANSFER: 'Transfer',
  CASH_OUT: 'Cash Out',
  CASH_IN: 'Cash In',
  DEBIT: 'Debit',
};

/* ── Alert panel item ─────────────────────────────────────────── */
function AlertItem({ tx }: { tx: LiveTransaction; index?: number }) {
  const pct = Math.round(tx.probability * 100);
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 space-y-1.5 animate-pulse-once">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
          <ShieldAlert size={10} /> FRAUD DETECTED
        </span>
        <span className="text-[10px] text-slate-400">{timeAgo(tx.receivedAt)}</span>
      </div>
      <div className="text-xs font-mono text-slate-700">{fakeTxnId(tx.round, tx.index)}</div>
      <div className="flex items-center justify-between text-[11px] text-slate-600">
        <span>{TYPE_LABELS[tx.raw.type] ?? tx.raw.type}</span>
        <span className="font-semibold text-slate-900">
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(tx.raw.amount)}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">Risk score</span>
        <span className="font-semibold text-rose-700">{pct}%</span>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────── */
export default function LiveStreamPage() {
  const { transactions, status, stats, connect, disconnect, clear } = useLiveStream();
  const tableRef = useRef<HTMLDivElement>(null);

  // auto-scroll to top when new tx arrives
  useEffect(() => {
    if (tableRef.current) tableRef.current.scrollTop = 0;
  }, [transactions.length]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<LiveTransaction | null>(null);
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;
  const fraudAlerts = transactions.filter((t) => t.prediction === 'FRAUD');

  const filteredTransactions = searchQuery.trim()
    ? transactions.filter((tx) => {
        const q = searchQuery.toLowerCase();
        const txnId = fakeTxnId(tx.round, tx.index).toLowerCase();
        const from = fakeAccount(tx.index * 3 + tx.round, 'ACC').toLowerCase();
        const to = fakeAccount(tx.index * 7 + tx.round + 13, 'ACC').toLowerCase();
        const type = (TYPE_LABELS[tx.raw.type] ?? tx.raw.type).toLowerCase();
        return txnId.includes(q) || from.includes(q) || to.includes(q) || type.includes(q);
      })
    : transactions;

  return (
    <PageWrapper>
      {selectedTx && <TransactionDrawer tx={selectedTx} onClose={() => setSelectedTx(null)} />}
      <div className="space-y-4">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-950">Live Transaction Stream</h1>
            <p className="mt-1 text-sm text-slate-500">Real-time bank transactions scored by XGBoost fraud model · 1 tx/sec</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status={status} />
            {status === 'connected' || status === 'connecting' ? (
              <button onClick={disconnect}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition">
                <WifiOff size={13} /> Pause
              </button>
            ) : (
              <button onClick={connect}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 shadow-sm hover:bg-emerald-100 transition">
                <Wifi size={13} /> Resume
              </button>
            )}
            {transactions.length > 0 && (
              <button onClick={clear}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 shadow-sm hover:bg-rose-100 transition">
                <Trash2 size={13} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: <Activity className="h-4 w-4 text-sky-600" />, label: 'Total', value: stats.total, cls: 'text-slate-950' },
            { icon: <ShieldAlert className="h-4 w-4 text-rose-600" />, label: 'Fraud Flagged', value: `${stats.fraud}${stats.total ? ` (${Math.round(stats.fraud/stats.total*100)}%)` : ''}`, cls: 'text-rose-700' },
            { icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />, label: 'Legitimate', value: stats.legit, cls: 'text-emerald-700' },
            { icon: <Zap className="h-4 w-4 text-amber-500" />, label: 'Model Accuracy', value: accuracy !== null ? `${accuracy}%` : '—', cls: 'text-slate-950' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-900/10 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2">
                {s.icon}
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</span>
              </div>
              <div className={`mt-1 text-2xl font-semibold tabular-nums ${s.cls}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Main 2-col layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">

          {/* Transaction stream — 2/3 width */}
          <div className="lg:col-span-2 rounded-xl border border-slate-900/10 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-900/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold text-slate-950">Incoming Transactions</div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search txn ID, account, type…"
                    className="h-8 w-[220px] rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
                {transactions.length > 0 && (
                  <span className="text-xs text-slate-400 whitespace-nowrap">{transactions.length} transactions</span>
                )}
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
                {status === 'connected' || status === 'connecting' ? (
                  <><Activity className="h-6 w-6 animate-pulse text-emerald-500" /><span className="text-sm">Waiting for transactions…</span></>
                ) : (
                  <><WifiOff className="h-6 w-6" /><span className="text-sm">Paused — click Resume to start</span></>
                )}
              </div>
            ) : (
              <div ref={tableRef} className="overflow-auto max-h-[560px]">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-white border-b border-slate-900/10">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="px-3 py-2">Txn ID</th>
                      <th className="px-3 py-2">From</th>
                      <th className="px-3 py-2">To</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Intelligence</th>
                      <th className="px-3 py-2">Risk Score</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Time</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx, i) => {
                      const isFraud = tx.prediction === 'FRAUD';
                      const isNew = i === 0;
                      const txnId = fakeTxnId(tx.round, tx.index);
                      const fromAcct = fakeAccount(tx.index * 3 + tx.round, 'ACC');
                      const toAcct = fakeAccount(tx.index * 7 + tx.round + 13, 'ACC');

                      return (
                        <tr
                          key={`${tx.round}-${tx.index}-${tx.receivedAt}`}
                          onClick={() => setSelectedTx(tx)}
                          className={[
                            'border-t border-slate-900/5 transition-colors cursor-pointer',
                            isNew ? 'bg-sky-50/60' : isFraud ? 'bg-rose-50/50 hover:bg-rose-100' : 'hover:bg-slate-50/70',
                          ].join(' ')}
                        >
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{txnId}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600">{fromAcct}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600">{toAcct}</td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                              {TYPE_LABELS[tx.raw.type] ?? tx.raw.type}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900 text-sm">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(tx.raw.amount)}
                          </td>
                          <td className="px-3 py-2.5 max-w-[180px]">
                            <GraphBadges graph={tx.graph} />
                          </td>
                          <td className="px-3 py-2.5 min-w-[140px]">
                            <ProbBar prob={tx.probability} />
                          </td>
                          <td className="px-3 py-2.5">
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
                          <td className="px-3 py-2.5 text-right text-[11px] text-slate-400 whitespace-nowrap">
                            {timeAgo(tx.receivedAt)}
                          </td>
                          <td className="px-3 py-2.5 text-slate-300">
                            <ChevronRight size={14} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Fraud Alerts panel — 1/3 width */}
          <div className="rounded-xl border border-slate-900/10 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-900/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-rose-600" />
                <span className="text-sm font-semibold text-slate-950">Fraud Alerts</span>
              </div>
              {fraudAlerts.length > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                  {fraudAlerts.length}
                </span>
              )}
            </div>

            <div className="overflow-auto max-h-[560px] p-3 space-y-2">
              {fraudAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
                  <ShieldCheck className="h-6 w-6 text-emerald-400" />
                  <span className="text-xs text-center">No fraud detected yet.<br />All transactions clear.</span>
                </div>
              ) : (
                fraudAlerts.map((tx, i) => (
                  <AlertItem key={`alert-${tx.round}-${tx.index}-${i}`} tx={tx} index={i} />
                ))
              )}
            </div>

            {fraudAlerts.length > 0 && (
              <div className="border-t border-slate-900/10 px-4 py-2.5 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] text-slate-500">
                  {fraudAlerts.length} alert{fraudAlerts.length > 1 ? 's' : ''} require analyst review
                </span>
              </div>
            )}
          </div>

        </div>
      </div>
    </PageWrapper>
  );
}
