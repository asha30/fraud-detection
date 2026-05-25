import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Brain,
  Clock,
  Download,
  Filter,
  History,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Timer,
  Users,
  X,
} from 'lucide-react';
import Badge from '../components/Badge';
import PageWrapper from '../components/PageWrapper';
import { useLiveStreamStore } from '../stores/useLiveStreamStore';
import type { LiveTransaction } from '../hooks/useLiveStream';

type RiskFilter = 'all' | 'high' | 'medium' | 'safe';
type SortKey = 'latest' | 'risk';
type TxnAction = 'safe' | 'escalated' | 'frozen';

/* ── helpers ──────────────────────────────────────────────────── */

function fakeTxnId(round: number, index: number) {
  return `TXN-${String(round).padStart(2, '0')}${String(index).padStart(3, '0')}`;
}

function fakeCustomerId(seed: number) {
  const n = ((seed * 6364136223846793005 + 1442695040888963407) >>> 0) % 900000 + 100000;
  return `CUST-${n.toString().slice(-5)}`;
}

function fakeAccount(seed: number, prefix: string) {
  const n = ((seed * 6364136223846793005 + 1442695040888963407) >>> 0) % 900000 + 100000;
  return `${prefix}••••${n.toString().slice(-4)}`;
}

function formatMoney(amount: number) {
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString();
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

const TYPE_LABELS_PLAIN: Record<string, string> = {
  PAYMENT: 'Payment',
  TRANSFER: 'Transfer',
  CASH_OUT: 'Cash Out',
  CASH_IN: 'Cash In',
  DEBIT: 'Debit',
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

/* ── Toast ────────────────────────────────────────────────────── */

type ToastMsg = { id: number; text: string; color: string };

function Toast({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: t.color, color: '#fff', borderRadius: 10, padding: '10px 18px',
          fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          animation: 'fadeSlideIn 0.2s ease',
        }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const counter = useRef(0);
  function show(text: string, color: string) {
    const id = ++counter.current;
    setToasts((p) => [...p, { id, text, color }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 2800);
  }
  return { toasts, show };
}

/* ── History Modal ────────────────────────────────────────────── */

function HistoryModal({ tx, allTx, onClose }: {
  tx: LiveTransaction;
  allTx: LiveTransaction[];
  onClose: () => void;
}) {
  const customerId = fakeCustomerId(tx.index * 3 + tx.round);
  const fromAcct = fakeAccount(tx.index * 3 + tx.round, 'ACC');
  const toAcct = fakeAccount(tx.index * 7 + tx.round + 13, 'ACC');

  // Show all transactions in the stream as account recent activity (sorted newest first)
  const history = useMemo(() => [...allTx].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, 50), [allTx]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}
      onClick={onClose}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 780,
        maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Account Transaction History</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Customer: {customerId}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f3f4f6', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#6b7280' }}>
            <X size={16} />
          </button>
        </div>

        {/* Account info */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #f3f4f6', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { label: 'Customer ID', value: customerId },
            { label: 'From Account', value: fromAcct },
            { label: 'To Account', value: toAcct },
          ].map((item) => (
            <div key={item.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginTop: 4, fontFamily: 'monospace' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Selected transaction details */}
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #f3f4f6', background: '#fffbeb' }}>
          <div style={{ fontSize: 11, color: '#92400e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Selected Transaction</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { label: 'TXN ID', value: fakeTxnId(tx.round, tx.index) },
              { label: 'Type', value: TYPE_LABELS_PLAIN[tx.raw.type] ?? tx.raw.type },
              { label: 'Amount', value: formatMoney(tx.raw.amount) },
              { label: 'Risk', value: `${Math.round(tx.probability * 100)}%` },
              { label: 'Old Balance (Sender)', value: formatMoney(tx.raw.oldbalanceOrg) },
              { label: 'New Balance (Sender)', value: formatMoney(tx.raw.newbalanceOrig) },
              { label: 'Old Balance (Recv)', value: formatMoney(tx.raw.oldbalanceDest) },
              { label: 'New Balance (Recv)', value: formatMoney(tx.raw.newbalanceDest) },
            ].map((item) => (
              <div key={item.label} style={{ background: '#fff', borderRadius: 6, padding: '8px 10px', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: 10, color: '#92400e', fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', marginTop: 2 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* History table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '12px 24px 6px', fontSize: 12, fontWeight: 600, color: '#374151' }}>
            Recent Stream Activity ({history.length} transactions)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['TXN ID', 'Type', 'Amount', 'Risk Score', 'Status', 'Time'].map((h) => (
                  <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((t, i) => {
                const isFraud = t.prediction === 'FRAUD';
                const pct = Math.round(t.probability * 100);
                const isSelected = t.round === tx.round && t.index === tx.index;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: isSelected ? '#fffbeb' : isFraud ? '#fff1f2' : undefined }}>
                    <td style={{ padding: '8px 16px', fontFamily: 'monospace', color: '#374151', fontWeight: isSelected ? 600 : 400 }}>{fakeTxnId(t.round, t.index)}</td>
                    <td style={{ padding: '8px 16px', color: '#6b7280' }}>{TYPE_LABELS_PLAIN[t.raw.type] ?? t.raw.type}</td>
                    <td style={{ padding: '8px 16px', fontWeight: 600, color: '#111827' }}>{formatMoney(t.raw.amount)}</td>
                    <td style={{ padding: '8px 16px' }}>
                      <span style={{ color: pct >= 50 ? '#dc2626' : pct >= 25 ? '#d97706' : '#059669', fontWeight: 600 }}>{pct}%</span>
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                        background: isFraud ? '#fee2e2' : '#dcfce7',
                        color: isFraud ? '#b91c1c' : '#15803d',
                      }}>
                        {isFraud ? 'Fraud' : 'Clear'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 16px', color: '#9ca3af' }}>{timeAgo(t.receivedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Download Modal ───────────────────────────────────────────── */

function DownloadModal({ allTx, onClose }: { allTx: LiveTransaction[]; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [txCount, setTxCount] = useState(50);
  const [filter, setFilter] = useState<'all' | 'fraud' | 'clear'>('all');

  const previewCount = useMemo(() => {
    const from = new Date(fromDate).setHours(0, 0, 0, 0);
    const to = new Date(toDate).setHours(23, 59, 59, 999);
    return allTx.filter((t) => {
      if (t.receivedAt < from || t.receivedAt > to) return false;
      if (filter === 'fraud') return t.prediction === 'FRAUD';
      if (filter === 'clear') return t.prediction !== 'FRAUD';
      return true;
    }).length;
  }, [allTx, fromDate, toDate, filter]);

  function generatePDF() {
    const from = new Date(fromDate).setHours(0, 0, 0, 0);
    const to = new Date(toDate).setHours(23, 59, 59, 999);
    const filtered = allTx
      .filter((t) => {
        if (t.receivedAt < from || t.receivedAt > to) return false;
        if (filter === 'fraud') return t.prediction === 'FRAUD';
        if (filter === 'clear') return t.prediction !== 'FRAUD';
        return true;
      })
      .slice(0, txCount);

    const fraudCount = filtered.filter((t) => t.prediction === 'FRAUD').length;
    const clearCount = filtered.length - fraudCount;
    const totalAmount = filtered.reduce((s, t) => s + t.raw.amount, 0);

    const rows = filtered.map((t) => {
      const isFraud = t.prediction === 'FRAUD';
      const pct = Math.round(t.probability * 100);
      return `
        <tr style="border-bottom:1px solid #e5e7eb; ${isFraud ? 'background:#fff1f2;' : ''}">
          <td style="padding:7px 10px;font-family:monospace;font-size:11px;">${fakeTxnId(t.round, t.index)}</td>
          <td style="padding:7px 10px;font-size:11px;">${TYPE_LABELS_PLAIN[t.raw.type] ?? t.raw.type}</td>
          <td style="padding:7px 10px;font-size:11px;font-weight:600;">${formatMoney(t.raw.amount)}</td>
          <td style="padding:7px 10px;font-size:11px;">${fakeCustomerId(t.index * 3 + t.round)}</td>
          <td style="padding:7px 10px;font-size:11px;color:${pct >= 50 ? '#dc2626' : pct >= 25 ? '#d97706' : '#059669'};font-weight:600;">${pct}%</td>
          <td style="padding:7px 10px;">
            <span style="padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;background:${isFraud ? '#fee2e2' : '#dcfce7'};color:${isFraud ? '#b91c1c' : '#15803d'};">
              ${isFraud ? 'FRAUD' : 'CLEAR'}
            </span>
          </td>
          <td style="padding:7px 10px;font-size:11px;color:#6b7280;">${formatDateTime(t.receivedAt)}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>FraudShield AI — Transaction Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; padding: 32px; }
    @media print { body { padding: 16px; } }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #1D9E75; }
    .logo { width: 36px; height: 36px; background: #1D9E75; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .title { font-size: 20px; font-weight: 700; color: #111827; }
    .subtitle { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
    .meta-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; font-weight: 600; }
    .meta-value { font-size: 22px; font-weight: 700; margin-top: 4px; }
    .section-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f3f4f6; }
    th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <svg width="18" height="18" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
      </svg>
    </div>
    <div>
      <div class="title">FraudShield AI — Transaction Report</div>
      <div class="subtitle">Generated on ${new Date().toLocaleString()} · Period: ${fromDate} → ${toDate} · Filter: ${filter === 'all' ? 'All transactions' : filter === 'fraud' ? 'Fraud only' : 'Clear only'}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-card">
      <div class="meta-label">Total Transactions</div>
      <div class="meta-value" style="color:#111827;">${filtered.length}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Fraud Detected</div>
      <div class="meta-value" style="color:#dc2626;">${fraudCount}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Clear Transactions</div>
      <div class="meta-value" style="color:#059669;">${clearCount}</div>
    </div>
    <div class="meta-card">
      <div class="meta-label">Total Amount</div>
      <div class="meta-value" style="color:#111827;font-size:16px;">${formatMoney(totalAmount)}</div>
    </div>
  </div>

  <div class="section-title">Transaction Details</div>
  <table>
    <thead>
      <tr>
        <th>TXN ID</th><th>Type</th><th>Amount</th><th>Customer</th><th>Risk Score</th><th>Status</th><th>Date &amp; Time</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    <span>FraudShield AI · Confidential · For authorized use only</span>
    <span>Report ID: RPT-${Date.now().toString(36).toUpperCase()}</span>
  </div>
  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    onClose();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}
      onClick={onClose}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
      }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 8px' }}>
              <Download size={16} color="#16a34a" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Download Report</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Export transactions as PDF</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#f3f4f6', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#6b7280' }}>
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', color: '#111827' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', color: '#111827' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
              Max Transactions: <strong>{txCount}</strong>
            </label>
            <input type="range" min={1} max={200} value={txCount} onChange={(e) => setTxCount(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#1D9E75' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              <span>1</span><span>200</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>Filter</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['all', 'fraud', 'clear'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid',
                  borderColor: filter === f ? (f === 'fraud' ? '#fca5a5' : f === 'clear' ? '#6ee7b7' : '#93c5fd') : '#e5e7eb',
                  background: filter === f ? (f === 'fraud' ? '#fee2e2' : f === 'clear' ? '#d1fae5' : '#dbeafe') : '#fff',
                  color: filter === f ? (f === 'fraud' ? '#b91c1c' : f === 'clear' ? '#065f46' : '#1e40af') : '#6b7280',
                  fontSize: 12, fontWeight: filter === f ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize',
                }}>
                  {f === 'all' ? 'All' : f === 'fraud' ? 'Fraud Only' : 'Clear Only'}
                </button>
              ))}
            </div>
          </div>

          {/* Preview count */}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#374151' }}>
            <span style={{ color: '#6b7280' }}>Matching transactions in range: </span>
            <strong style={{ color: '#111827' }}>{previewCount}</strong>
            <span style={{ color: '#6b7280' }}> · Will export up to </span>
            <strong style={{ color: '#111827' }}>{txCount}</strong>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #e5e7eb',
            background: '#fff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={generatePDF} disabled={previewCount === 0} style={{
            flex: 2, padding: '10px 0', borderRadius: 10, border: 'none',
            background: previewCount === 0 ? '#d1fae5' : '#1D9E75', color: '#fff',
            fontSize: 13, fontWeight: 600, cursor: previewCount === 0 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Download size={15} />
            {previewCount === 0 ? 'No data in range' : 'Generate PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Summary card ─────────────────────────────────────────────── */

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

/* ── LLM types ────────────────────────────────────────────────── */

interface LLMSignal { name: string; severity: string; detail: string; }
interface LLMReport {
  fraud_report: {
    title: string; risk_level: string; confidence: string;
    what_happened: string; why_fraud: string;
    signals: LLMSignal[];
    recommended_action: string;
    alert_id: string;
    detected_at: string;
  };
  received_at: string;
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

/* ── Alert Detail Panel ───────────────────────────────────────── */

function AlertDetailPanel({
  tx, onMarkSafe, onEscalate, onFreeze, onHistory, actionState,
}: {
  tx: LiveTransaction;
  onMarkSafe: () => void;
  onEscalate: () => void;
  onFreeze: () => void;
  onHistory: () => void;
  actionState: TxnAction | null;
}) {
  const pct = Math.round(tx.probability * 100);
  const risk = riskFromProb(tx.probability);
  const txnId = fakeTxnId(tx.round, tx.index);
  const customerId = fakeCustomerId(tx.index * 3 + tx.round);
  const accountNo = fakeAccount(tx.index * 3 + tx.round, 'ACC');
  const fraudType = TYPE_LABELS[tx.raw.type] ?? 'Unknown Fraud';

  const llmReport = useTxInsight(tx.round, tx.index);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Alert details</div>
          <div className="mt-0.5 text-xs text-slate-500">{txnId}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={risk === 'high' ? 'high' : risk === 'medium' ? 'medium' : 'safe'}>{riskLabel(risk)}</Badge>
          {actionState && (
            <span style={{
              padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
              background: actionState === 'safe' ? '#dcfce7' : actionState === 'escalated' ? '#fef9c3' : '#fee2e2',
              color: actionState === 'safe' ? '#15803d' : actionState === 'escalated' ? '#92400e' : '#b91c1c',
              border: `1px solid ${actionState === 'safe' ? '#86efac' : actionState === 'escalated' ? '#fde047' : '#fca5a5'}`,
            }}>
              {actionState === 'safe' ? '✓ Marked Safe' : actionState === 'escalated' ? '⬆ Escalated' : '🔒 Frozen'}
            </span>
          )}
        </div>
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
          <div className="rounded-lg border border-slate-200 p-3 col-span-2">
            <div className="text-[11px] font-medium text-slate-500">Account No.</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{accountNo}</div>
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

        {/* Action buttons */}
        <div className="grid grid-cols-1 gap-2 pt-1">
          <button
            type="button"
            onClick={onMarkSafe}
            disabled={actionState === 'safe'}
            className="inline-flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck size={14} className="mr-1.5" />
            {actionState === 'safe' ? 'Marked Safe' : 'Mark Safe'}
          </button>
          <button
            type="button"
            onClick={onEscalate}
            disabled={actionState === 'escalated' || actionState === 'frozen'}
            className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <AlertTriangle size={14} className="mr-1.5" />
            {actionState === 'escalated' ? 'Escalated' : 'Escalate'}
          </button>
          <button
            type="button"
            onClick={onFreeze}
            disabled={actionState === 'frozen' || actionState === 'safe'}
            className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Shield size={14} className="mr-1.5" />
            {actionState === 'frozen' ? 'Transaction Frozen' : 'Freeze Transaction'}
          </button>
          <button
            type="button"
            onClick={onHistory}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <History size={14} className="mr-1.5" />
            View Account History
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────── */

export default function AlertsPage() {
  const { transactions, stats } = useLiveStreamStore();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [actions, setActions] = useState<Map<string, TxnAction>>(new Map());
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('latest');
  const [historyTx, setHistoryTx] = useState<LiveTransaction | null>(null);
  const [showDownload, setShowDownload] = useState(false);
  const { toasts, show: showToast } = useToasts();

  const fraudTxs = useMemo(() => transactions.filter((t) => t.prediction === 'FRAUD'), [transactions]);
  const activeFraud = useMemo(() => fraudTxs.filter((t) => !dismissed.has(`${t.round}-${t.index}`)), [fraudTxs, dismissed]);
  const highRisk = activeFraud.filter((t) => riskFromProb(t.probability) === 'high');
  const resolvedCount = dismissed.size + [...actions.values()].filter((a) => a === 'frozen' || a === 'escalated').length;

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

  function txKey(tx: LiveTransaction) { return `${tx.round}-${tx.index}`; }

  function handleMarkSafe(tx: LiveTransaction) {
    const key = txKey(tx);
    setDismissed((prev) => new Set([...prev, key]));
    setActions((prev) => new Map([...prev, [key, 'safe']]));
    setSelectedKey(null);
    showToast(`✓ TXN ${fakeTxnId(tx.round, tx.index)} marked as safe`, '#059669');
  }

  function handleEscalate(tx: LiveTransaction) {
    const key = txKey(tx);
    setActions((prev) => new Map([...prev, [key, 'escalated']]));
    showToast(`⬆ TXN ${fakeTxnId(tx.round, tx.index)} escalated for review`, '#d97706');
  }

  function handleFreeze(tx: LiveTransaction) {
    const key = txKey(tx);
    setActions((prev) => new Map([...prev, [key, 'frozen']]));
    showToast(`🔒 TXN ${fakeTxnId(tx.round, tx.index)} transaction frozen`, '#dc2626');
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
            <button
              onClick={() => setShowDownload(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <Download size={13} /> Download
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card title="Active Alerts" value={String(activeFraud.length)} subtext="Open fraud cases" icon={Siren} />
          <Card title="High Risk Cases" value={String(highRisk.length)} subtext="Escalation recommended" icon={AlertTriangle} />
          <Card title="Resolved" value={String(resolvedCount)} subtext="Marked safe / actioned" icon={Activity} />
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
                      const action = actions.get(key);
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
                            {action ? (
                              <span style={{
                                padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                                background: action === 'safe' ? '#dcfce7' : action === 'escalated' ? '#fef9c3' : '#fee2e2',
                                color: action === 'safe' ? '#15803d' : action === 'escalated' ? '#92400e' : '#b91c1c',
                              }}>
                                {action === 'safe' ? 'Safe' : action === 'escalated' ? 'Escalated' : 'Frozen'}
                              </span>
                            ) : (
                              <Badge variant={risk === 'high' ? 'high' : risk === 'medium' ? 'medium' : 'safe'}>
                                {riskLabel(risk)}
                              </Badge>
                            )}
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
              <AlertDetailPanel
                tx={selectedTx}
                actionState={actions.get(txKey(selectedTx)) ?? null}
                onMarkSafe={() => handleMarkSafe(selectedTx)}
                onEscalate={() => handleEscalate(selectedTx)}
                onFreeze={() => handleFreeze(selectedTx)}
                onHistory={() => setHistoryTx(selectedTx)}
              />
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

      {/* Modals */}
      {historyTx && (
        <HistoryModal
          tx={historyTx}
          allTx={transactions}
          onClose={() => setHistoryTx(null)}
        />
      )}
      {showDownload && (
        <DownloadModal
          allTx={transactions}
          onClose={() => setShowDownload(false)}
        />
      )}

      {/* Toast notifications */}
      <Toast toasts={toasts} />

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </PageWrapper>
  );
}
