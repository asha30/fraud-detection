import { X, ShieldAlert, ShieldCheck, CreditCard, Clock, Fingerprint, CheckSquare, Monitor, User, ArrowRight } from 'lucide-react';
import type { LiveTransaction } from '../hooks/useLiveStream';

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

function fakeTxnId(round: number, index: number) {
  return `TXN-${String(round).padStart(2, '0')}${String(index).padStart(3, '0')}`;
}
function fakeAccount(seed: number) {
  const n = ((seed * 6364136223846793005 + 1442695040888963407) >>> 0) % 900000 + 100000;
  return `ACC••••${n.toString().slice(-4)}`;
}

/* ── small reusable pieces ───────────────────────────────────── */

function SectionHeader({ icon, title, color = '#6b7280' }: { icon: React.ReactNode; title: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span style={{ color }}>{icon}</span>
      <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{title}</span>
    </div>
  );
}

function KV({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-[11px] font-semibold tabular-nums ${highlight ? 'text-rose-700' : 'text-slate-800'}`}>{value}</span>
    </div>
  );
}

function MatchPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
      ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-rose-50 text-rose-700 ring-rose-200'
    }`}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

function FeatureGrid({ data }: { data: Record<string, number | null> }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="rounded-md bg-slate-50 px-2 py-1.5 text-center">
          <div className="text-[9px] text-slate-400 uppercase tracking-wide truncate">{k}</div>
          <div className="text-xs font-semibold text-slate-700 tabular-nums">{v ?? '—'}</div>
        </div>
      ))}
    </div>
  );
}

function BalanceFlow({ old: oldBal, new: newBal, label }: { old: number; new: number; label: string }) {
  const delta = newBal - oldBal;
  const isDown = delta < 0;
  return (
    <div className="flex-1 rounded-xl border border-slate-100 bg-slate-50 p-3 text-center space-y-1">
      <div className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold text-slate-700">{fmt.format(oldBal)}</div>
      <div className="flex justify-center">
        <span className={`text-[10px] font-bold ${isDown ? 'text-rose-600' : 'text-emerald-600'}`}>
          {isDown ? '▼' : '▲'} {fmt.format(Math.abs(delta))}
        </span>
      </div>
      <div className="text-sm font-semibold text-slate-900">{fmt.format(newBal)}</div>
    </div>
  );
}

/* ── main drawer ─────────────────────────────────────────────── */

export default function TransactionDrawer({
  tx,
  onClose,
}: {
  tx: LiveTransaction;
  onClose: () => void;
}) {
  const isFraud = tx.prediction === 'FRAUD';
  const pct = Math.round(tx.probability * 100);
  const txnId = fakeTxnId(tx.round, tx.index);
  const fromAcct = fakeAccount(tx.index * 3 + tx.round);
  const toAcct = fakeAccount(tx.index * 7 + tx.round + 13);
  const g = tx.graph;
  const feats = tx.features;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-[480px] overflow-y-auto bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className={`flex items-start justify-between px-5 py-4 border-b ${isFraud ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isFraud
                ? <ShieldAlert className="h-5 w-5 text-rose-600" />
                : <ShieldCheck className="h-5 w-5 text-emerald-600" />}
              <span className={`text-base font-bold ${isFraud ? 'text-rose-800' : 'text-emerald-800'}`}>
                {isFraud ? 'Fraud Detected' : 'Transaction Clear'}
              </span>
            </div>
            <div className="font-mono text-sm text-slate-600">{txnId}</div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>{fromAcct}</span>
              <ArrowRight size={12} />
              <span>{toAcct}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-black/10 transition">
              <X size={16} className="text-slate-600" />
            </button>
            <div className={`text-2xl font-bold tabular-nums ${isFraud ? 'text-rose-700' : 'text-emerald-700'}`}>
              {pct}%
            </div>
            <div className="text-[10px] text-slate-500">risk score</div>
          </div>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">

          {/* ── LAYER 1: Transaction Summary ── */}
          <section>
            <SectionHeader icon={<CreditCard size={14} />} title="Layer 1 · Transaction Summary" color="#0284c7" />
            <div className="rounded-xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Type</span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{tx.raw.type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Amount</span>
                <span className={`text-lg font-bold tabular-nums ${isFraud ? 'text-rose-700' : 'text-slate-900'}`}>{fmt.format(tx.raw.amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Step (hour)</span>
                <span className="text-xs font-semibold text-slate-700">{tx.raw.step}</span>
              </div>
              {/* Balance flow */}
              <div className="flex gap-2 pt-1">
                <BalanceFlow old={tx.raw.oldbalanceOrg} new={tx.raw.newbalanceOrig} label="Sender" />
                <BalanceFlow old={tx.raw.oldbalanceDest} new={tx.raw.newbalanceDest} label="Receiver" />
              </div>
              {/* Zero balance flag */}
              {tx.raw.newbalanceOrig === 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 font-semibold">
                  <ShieldAlert size={12} /> Account fully drained — high fraud signal
                </div>
              )}
            </div>
          </section>

          {/* ── LAYER 2: Intelligence / KYC ── */}
          {g && (
            <section>
              <SectionHeader icon={<Fingerprint size={14} />} title="Layer 2 · Graph & KYC Intelligence" color="#7c3aed" />
              <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3 space-y-3">
                {/* Signal pills */}
                <div className="flex flex-wrap gap-1.5">
                  <MatchPill ok={g.kyc_email_match} label="Email match" />
                  <MatchPill ok={g.kyc_ssn_reuse === 0} label={`SSN reuse: ${g.kyc_ssn_reuse}×`} />
                  <MatchPill ok={g.kyc_phone_reuse <= 1} label={`Phone reuse: ${g.kyc_phone_reuse}×`} />
                  <MatchPill ok={g.d1_days >= 10} label={`D1: ${g.d1_days.toFixed(1)} days`} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <KV label="Card ID" value={g.card_id ?? '—'} />
                  <KV label="Device" value={g.device_type} />
                  <KV label="Addr / Card ratio" value={g.addr_per_card.toFixed(2)} highlight={g.addr_per_card > 2} />
                  <KV label="D1 (days since last tx)" value={`${g.d1_days.toFixed(1)}d`} highlight={g.d1_days < 5} />
                </div>
              </div>
            </section>
          )}

          {/* ── LAYER 3: All 68 Features ── */}
          {feats && (
            <section>
              <SectionHeader icon={<Monitor size={14} />} title="Layer 3 · All 68 Model Features" color="#059669" />
              <div className="space-y-3">

                {/* Card & Address */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CreditCard size={12} className="text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Card & Address</span>
                  </div>
                  <FeatureGrid data={feats.card} />
                </div>

                {/* Velocity (C features) */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock size={12} className="text-orange-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Velocity (C1–C10)</span>
                  </div>
                  <FeatureGrid data={feats.velocity} />
                  <p className="mt-2 text-[10px] text-slate-400">Count of linked accounts / devices per card hub</p>
                </div>

                {/* Time Delta (D features) */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock size={12} className="text-purple-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-purple-600">Time Delta (D1–D15)</span>
                  </div>
                  <FeatureGrid data={feats.time_delta} />
                  <p className="mt-2 text-[10px] text-slate-400">Days since last transaction per card/device/address</p>
                </div>

                {/* Match Flags (M features) */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckSquare size={12} className="text-emerald-600" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Match Flags (M1–M6)</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(feats.match_flags).map(([k, v]) => (
                      <span key={k} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                        v === 1 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : v === 0 ? 'bg-rose-50 text-rose-700 ring-rose-200'
                        : 'bg-slate-50 text-slate-500 ring-slate-200'
                      }`}>
                        {k}: {v ?? '—'}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400">1 = match, 0 = mismatch (address/name/email/phone)</p>
                </div>

                {/* Device & Browser */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Monitor size={12} className="text-slate-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Device & Browser</span>
                  </div>
                  <FeatureGrid data={feats.device} />
                </div>

                {/* Identity scores */}
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Fingerprint size={12} className="text-indigo-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Identity Scores (id_xx)</span>
                  </div>
                  <FeatureGrid data={feats.identity} />
                  <p className="mt-2 text-[10px] text-slate-400">Browser fingerprint & behavioural anomaly scores</p>
                </div>

                {/* KYC */}
                <div className="rounded-xl border border-purple-100 bg-purple-50/30 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <User size={12} className="text-purple-600" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-purple-700">KYC / Identity Verification</span>
                  </div>
                  <div className="space-y-0.5">
                    {Object.entries(feats.kyc).map(([k, v]) => {
                      const isRed = (k === 'kyc_ssn_reuse_count' && Number(v) >= 2)
                        || (k === 'kyc_email_matches_tx' && v === 0)
                        || (k === 'kyc_phone_reuse_count' && Number(v) >= 2)
                        || (k === 'email_domain_match' && v === 0);
                      return <KV key={k} label={k} value={String(v ?? '—')} highlight={isRed} />;
                    })}
                  </div>
                </div>

              </div>
            </section>
          )}

        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between bg-slate-50">
          <span className="text-[11px] text-slate-400">Round {tx.round} · Index {tx.index} · {tx.features ? '68 features' : 'basic'}</span>
          <button onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">
            Close
          </button>
        </div>
      </div>
    </>
  );
}
