import { useEffect, useState } from 'react';
import { Network, Database, AlertTriangle, Shield, RefreshCw, Search, CreditCard, Monitor, MapPin, Mail } from 'lucide-react';
import PageWrapper from '../components/PageWrapper';

const API = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8002';

type HubRow = {
  hub_id: string;
  hub_type: 'card' | 'device' | 'address' | 'email';
  total_tx: number;
  fraud_tx: number;
  fraud_rate: number;
  ring_size: number;
};

type GraphStats = {
  nodes: Record<string, number>;
  edges: Record<string, number>;
  live: { total: number; fraud: number };
  hub_summary: { hub_type: string; hubs: number; avg_fraud_rate: number; max_fraud_rate: number }[];
};

/* ── helpers ── */
const HUB_TYPE_CONFIG = {
  card:    { icon: <CreditCard size={12} />, color: '#3b82f6', bg: 'bg-blue-50',   text: 'text-blue-700',   ring: 'ring-blue-200'   },
  device:  { icon: <Monitor   size={12} />, color: '#8b5cf6', bg: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-200' },
  address: { icon: <MapPin    size={12} />, color: '#f59e0b', bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-200'  },
  email:   { icon: <Mail      size={12} />, color: '#10b981', bg: 'bg-emerald-50',text: 'text-emerald-700',ring: 'ring-emerald-200'},
} as const;

function HubTypeBadge({ type }: { type: HubRow['hub_type'] }) {
  const c = HUB_TYPE_CONFIG[type];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 capitalize ${c.bg} ${c.text} ${c.ring}`}>
      {c.icon} {type}
    </span>
  );
}

function FraudBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 60 ? '#dc2626' : pct >= 30 ? '#ea580c' : pct >= 10 ? '#d97706' : '#16a34a';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-9 text-xs font-bold tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  );
}

function RiskBadge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const cfg = pct >= 60
    ? { label: 'Critical', cls: 'bg-red-100 text-red-700 ring-red-200' }
    : pct >= 30 ? { label: 'High',     cls: 'bg-orange-100 text-orange-700 ring-orange-200' }
    : pct >= 10 ? { label: 'Medium',   cls: 'bg-yellow-100 text-yellow-700 ring-yellow-200' }
    : { label: 'Low', cls: 'bg-emerald-100 text-emerald-700 ring-emerald-200' };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

const SORT_OPTS = [
  { value: 'fraud_rate', label: 'Fraud Rate' },
  { value: 'total_tx',   label: 'Total Tx'   },
  { value: 'ring_size',  label: 'Ring Size'  },
];

const FILTER_TABS = ['all', 'card', 'device', 'address', 'email'] as const;
type FilterTab = typeof FILTER_TABS[number];

export default function GraphIntelligencePage() {
  const [stats, setStats]           = useState<GraphStats | null>(null);
  const [hubs, setHubs]             = useState<HubRow[]>([]);
  const [activeTab, setActiveTab]   = useState<FilterTab>('all');
  const [minFraudRate, setMinFraudRate] = useState(0.1);
  const [minTx, setMinTx]           = useState(10);
  const [sortBy, setSortBy]         = useState<'fraud_rate' | 'total_tx' | 'ring_size'>('fraud_rate');
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(false);

  const fetchStats = () =>
    fetch(`${API}/graph/stats`).then(r => r.json()).then(setStats).catch(() => {});

  const fetchHubs = () => {
    setLoading(true);
    const type = activeTab === 'all' ? 'all' : activeTab;
    fetch(`${API}/graph/hubs?hub_type=${type}&min_fraud_rate=${minFraudRate}&min_tx=${minTx}&limit=200&sort_by=${sortBy}`)
      .then(r => r.json())
      .then(data => { setHubs(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchHubs(); }, [activeTab, minFraudRate, minTx, sortBy]);

  const totalNodes = stats ? Object.values(stats.nodes).reduce((a, b) => a + b, 0) : 0;
  const totalEdges = stats ? Object.values(stats.edges).reduce((a, b) => a + b, 0) : 0;

  const filtered = search.trim()
    ? hubs.filter(h => h.hub_id.toLowerCase().includes(search.toLowerCase()) || h.hub_type.includes(search.toLowerCase()))
    : hubs;

  return (
    <PageWrapper>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-950">Graph Intelligence</h1>
            <p className="mt-1 text-sm text-slate-500">
              All hub types stitched together · {totalNodes.toLocaleString()} nodes · {totalEdges.toLocaleString()} edges · <span className="font-medium text-slate-700">Fraud_database_1</span>
            </p>
          </div>
          <button onClick={() => { fetchStats(); fetchHubs(); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: <Network   className="h-4 w-4 text-blue-600"    />, label: 'Graph Nodes',        value: totalNodes.toLocaleString()              },
            { icon: <Database  className="h-4 w-4 text-purple-600"  />, label: 'Graph Edges',        value: totalEdges.toLocaleString()              },
            { icon: <AlertTriangle className="h-4 w-4 text-rose-600" />, label: 'Live Fraud Txns',   value: stats?.live.fraud?.toLocaleString() ?? '—' },
            { icon: <Shield    className="h-4 w-4 text-emerald-600" />, label: 'Transactions Scored',value: stats?.live.total?.toLocaleString() ?? '—' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-slate-900/10 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2">
                {s.icon}
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</span>
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Hub type summary row */}
        {stats?.hub_summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.hub_summary.map(h => {
              const cfg = HUB_TYPE_CONFIG[h.hub_type as keyof typeof HUB_TYPE_CONFIG];
              return (
                <div key={h.hub_type}
                  onClick={() => setActiveTab(h.hub_type as FilterTab)}
                  className={`rounded-xl border cursor-pointer p-3 shadow-sm transition hover:shadow-md ${activeTab === h.hub_type ? 'border-slate-400 bg-slate-50' : 'border-slate-900/10 bg-white'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide" style={{ color: cfg?.color }}>
                      {cfg?.icon} {h.hub_type} hubs
                    </span>
                    <span className="text-xs font-semibold text-slate-600">{h.hubs.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Avg fraud rate</span>
                    <span className="font-semibold text-amber-600">{(h.avg_fraud_rate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Max fraud rate</span>
                    <span className="font-semibold text-red-600">{(h.max_fraud_rate * 100).toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Unified table */}
        <div className="rounded-xl border border-slate-900/10 bg-white shadow-sm">

          {/* Controls bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/10 px-4 py-3">
            {/* Type filter tabs */}
            <div className="flex gap-1 flex-wrap">
              {FILTER_TABS.map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                    activeTab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}>
                  {t === 'all' ? '⬛ All types' : (
                    <span className="inline-flex items-center gap-1">
                      {HUB_TYPE_CONFIG[t].icon} {t}s
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search hub ID…"
                  className="h-7 w-40 rounded-lg border border-slate-200 bg-white pl-7 pr-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-emerald-200" />
              </div>
              {/* Sort */}
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span>Sort</span>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700">
                  {SORT_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {/* Min Tx */}
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span>Min Tx</span>
                <select value={minTx} onChange={e => setMinTx(Number(e.target.value))}
                  className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700">
                  <option value={1}>≥1</option>
                  <option value={5}>≥5</option>
                  <option value={10}>≥10</option>
                  <option value={20}>≥20</option>
                  <option value={50}>≥50</option>
                </select>
              </div>
              {/* Min Fraud Rate */}
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span>Min Fraud</span>
                <select value={minFraudRate} onChange={e => setMinFraudRate(Number(e.target.value))}
                  className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700">
                  <option value={0}>All</option>
                  <option value={0.1}>≥10%</option>
                  <option value={0.25}>≥25%</option>
                  <option value={0.5}>≥50%</option>
                  <option value={0.8}>≥80%</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm gap-2">
              <RefreshCw size={14} className="animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              No hubs match this filter.
            </div>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-white border-b border-slate-900/10">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Hub ID</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5 text-right">Total Tx</th>
                    <th className="px-4 py-2.5 text-right">Fraud Tx</th>
                    <th className="px-4 py-2.5">Fraud Rate</th>
                    <th className="px-4 py-2.5 text-right">Ring Size</th>
                    <th className="px-4 py-2.5">Risk Level</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((h, i) => (
                    <tr key={h.hub_id}
                      className={`border-t border-slate-900/5 hover:bg-slate-50/60 transition-colors ${
                        h.hub_type === 'card'    ? 'hover:bg-blue-50/30'   :
                        h.hub_type === 'device'  ? 'hover:bg-purple-50/30' :
                        h.hub_type === 'address' ? 'hover:bg-amber-50/30'  :
                                                   'hover:bg-emerald-50/30'
                      }`}>
                      <td className="px-4 py-2.5 text-[11px] text-slate-400 tabular-nums">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs font-medium text-slate-800">{h.hub_id}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <HubTypeBadge type={h.hub_type} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-sm text-slate-700">{h.total_tx.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-sm font-semibold text-rose-700">{h.fraud_tx.toLocaleString()}</td>
                      <td className="px-4 py-2.5"><FraudBar rate={h.fraud_rate} /></td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-sm text-slate-600">{h.ring_size.toLocaleString()}</td>
                      <td className="px-4 py-2.5"><RiskBadge rate={h.fraud_rate} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-900/10 px-4 py-2.5 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {filtered.length} hubs shown · {activeTab === 'all' ? 'all types' : activeTab + 's'} · source: Fraud_database_1 → hub_stats
            </span>
            <div className="flex gap-2">
              {(['card','device','address','email'] as const).map(t => {
                const count = filtered.filter(h => h.hub_type === t).length;
                if (!count) return null;
                const c = HUB_TYPE_CONFIG[t];
                return (
                  <span key={t} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${c.bg} ${c.text} ${c.ring}`}>
                    {c.icon} {count} {t}s
                  </span>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </PageWrapper>
  );
}
