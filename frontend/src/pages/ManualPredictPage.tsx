import { useState } from 'react';
import {
  ShieldAlert, ShieldCheck, ShieldOff, Send, RotateCcw,
  CreditCard, User, Clock, CheckSquare, ChevronDown, ChevronUp,
  AlertTriangle, Lightbulb, Zap,
} from 'lucide-react';
import PageWrapper from '../components/PageWrapper';

const API = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8002';

type Result = {
  prediction: string;
  fraud_probability: number;
  risk_level: string;
  recommended_action: string;
  status: string;
  reasons: string[];
  confidence: number;
};

const TX_TYPES = ['PAYMENT', 'TRANSFER', 'CASH_OUT', 'CASH_IN', 'DEBIT'];

/* ── Example presets ─────────────────────────────────────────── */
const EXAMPLES = [
  {
    label: 'Suspicious Transfer',
    color: 'rose',
    description: 'High amount, SSN reused, email mismatch, recent velocity',
    values: {
      TransactionAmt: '8500', tx_type: 'TRANSFER',
      card1: '10644', addr1: '210', D1: '1.5',
      M4: '0', M5: '0', M6: '1',
      kyc_email_matches_tx: '0', kyc_ssn_reuse_count: '4',
      kyc_phone_reuse_count: '2', addr_per_card_ratio: '2.8',
    },
  },
  {
    label: 'Normal Payment',
    color: 'emerald',
    description: 'Small amount, all KYC matches, no reuse',
    values: {
      TransactionAmt: '125', tx_type: 'PAYMENT',
      card1: '5432', addr1: '350', D1: '120',
      M4: '1', M5: '1', M6: '1',
      kyc_email_matches_tx: '1', kyc_ssn_reuse_count: '0',
      kyc_phone_reuse_count: '0', addr_per_card_ratio: '0.5',
    },
  },
  {
    label: 'Medium Risk Cash Out',
    color: 'amber',
    description: 'Moderate amount, phone reused, address mismatch',
    values: {
      TransactionAmt: '3200', tx_type: 'CASH_OUT',
      card1: '7890', addr1: '180', D1: '4',
      M4: '1', M5: '1', M6: '0',
      kyc_email_matches_tx: '1', kyc_ssn_reuse_count: '1',
      kyc_phone_reuse_count: '3', addr_per_card_ratio: '1.8',
    },
  },
];

const INITIAL: Record<string, string> = {
  TransactionAmt: '', tx_type: 'PAYMENT',
  card1: '', addr1: '', D1: '',
  M4: '1', M5: '1', M6: '1',
  kyc_email_matches_tx: '1',
  kyc_ssn_reuse_count: '0',
  kyc_phone_reuse_count: '0',
  addr_per_card_ratio: '',
};

const RISK_CFG: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  Critical: { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-800',    icon: <ShieldAlert className="h-7 w-7 text-red-600"     /> },
  High:     { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', icon: <ShieldAlert className="h-7 w-7 text-orange-500"   /> },
  Medium:   { bg: 'bg-yellow-50', border: 'border-yellow-300', text: 'text-yellow-800', icon: <ShieldOff   className="h-7 w-7 text-yellow-500"   /> },
  Low:      { bg: 'bg-emerald-50',border: 'border-emerald-300',text: 'text-emerald-800',icon: <ShieldCheck className="h-7 w-7 text-emerald-600"  /> },
};

/* ── Field with description ───────────────────────────────────── */
function Field({
  label, name, value, onChange, placeholder, required,
  description, options, type = 'number',
}: {
  label: string; name: string; value: string; type?: string;
  onChange: (n: string, v: string) => void; placeholder?: string;
  required?: boolean; description?: string; options?: string[];
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{label}</label>
        {required
          ? <span className="rounded-full bg-rose-100 px-1.5 py-px text-[9px] font-bold text-rose-600">REQUIRED</span>
          : <span className="rounded-full bg-slate-100 px-1.5 py-px text-[9px] text-slate-400">optional</span>}
      </div>
      {description && (
        <p className="text-[10px] text-slate-400 leading-relaxed">{description}</p>
      )}
      {options ? (
        <select value={value} onChange={e => onChange(name, e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-300 transition">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-300 transition placeholder:text-slate-300" />
      )}
    </div>
  );
}

/* ── Toggle with 0/1 explained ───────────────────────────────── */
function MatchToggle({
  label, name, value, onChange, zeroLabel, oneLabel, description,
}: {
  label: string; name: string; value: string;
  onChange: (n: string, v: string) => void;
  zeroLabel: string; oneLabel: string; description?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{label}</label>
      {description && <p className="text-[10px] text-slate-400">{description}</p>}
      <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
        <button type="button" onClick={() => onChange(name, '1')}
          className={`flex-1 py-2 px-2 transition ${value === '1' ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          1 — {oneLabel}
        </button>
        <button type="button" onClick={() => onChange(name, '0')}
          className={`flex-1 py-2 px-2 transition ${value === '0' ? 'bg-rose-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
          0 — {zeroLabel}
        </button>
      </div>
    </div>
  );
}

export default function ManualPredictPage() {
  const [form, setForm] = useState<Record<string, string>>(INITIAL);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = (name: string, value: string) => setForm(f => ({ ...f, [name]: value }));

  const loadExample = (ex: typeof EXAMPLES[0]) => {
    setForm({ ...INITIAL, ...ex.values });
    setResult(null); setError('');
  };

  const reset = () => { setForm(INITIAL); setResult(null); setError(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.TransactionAmt) { setError('Transaction amount is required.'); return; }
    setError(''); setLoading(true);

    const payload: Record<string, string | number> = { tx_type: form.tx_type };
    const numFields = [
      'TransactionAmt','card1','addr1','D1',
      'kyc_email_matches_tx','kyc_ssn_reuse_count','kyc_phone_reuse_count','addr_per_card_ratio',
      'M4','M5','M6',
    ];
    for (const k of numFields) {
      if (form[k] !== '' && form[k] !== undefined) payload[k] = Number(form[k]);
    }

    try {
      const res = await fetch(`${API}/predict/manual`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setResult(await res.json());
    } catch {
      setError('Cannot reach backend on port 8002.');
    } finally { setLoading(false); }
  };

  const cfg   = result ? (RISK_CFG[result.risk_level] ?? RISK_CFG.Low) : null;
  const pct   = result ? Math.round(result.fraud_probability * 100) : 0;
  const barColor = pct >= 75 ? '#dc2626' : pct >= 50 ? '#ea580c' : pct >= 26 ? '#d97706' : '#16a34a';

  return (
    <PageWrapper>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-950">Manual Fraud Check</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter what you have — only <span className="font-semibold text-slate-700">Amount</span> is required.
            All other fields use safe defaults if left blank.
          </p>
        </div>

        {/* Example presets */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={13} className="text-amber-500" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Try an Example</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {EXAMPLES.map(ex => (
              <button key={ex.label} type="button" onClick={() => loadExample(ex)}
                className={`rounded-lg border-2 p-3 text-left transition hover:shadow-md ${
                  ex.color === 'rose'    ? 'border-rose-200    bg-rose-50    hover:border-rose-400'    :
                  ex.color === 'emerald' ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-400' :
                                          'border-amber-200   bg-amber-50   hover:border-amber-400'
                }`}>
                <div className={`text-xs font-bold mb-0.5 ${
                  ex.color === 'rose' ? 'text-rose-700' : ex.color === 'emerald' ? 'text-emerald-700' : 'text-amber-700'
                }`}>{ex.label}</div>
                <div className="text-[10px] text-slate-500 leading-relaxed">{ex.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">

          {/* ── FORM ── */}
          <form onSubmit={submit} className="lg:col-span-3 space-y-4">

            {/* Transaction */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <CreditCard size={15} className="text-blue-500" />
                <span className="text-sm font-bold text-slate-800">Transaction Details</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Transaction Amount ($)" name="TransactionAmt" value={form.TransactionAmt}
                    onChange={set} placeholder="e.g. 8500.00" required
                    description="The dollar amount of this transaction. Amounts over $4,000 are a fraud signal." />
                </div>
                <Field label="Transaction Type" name="tx_type" type="text" value={form.tx_type}
                  onChange={set} options={TX_TYPES} required
                  description="PAYMENT = buying goods · TRANSFER = sending money · CASH_OUT = withdrawing cash · CASH_IN = deposit · DEBIT = card swipe" />
                <Field label="Card ID (card1)" name="card1" value={form.card1}
                  onChange={set} placeholder="e.g. 5432"
                  description="Hashed card number (1000–20000). Cards in range 10000–12000 are flagged as a known fraud ring in our graph." />
                <Field label="Billing Address Code (addr1)" name="addr1" value={form.addr1}
                  onChange={set} placeholder="e.g. 299"
                  description="Encoded billing zip/address (100–500). Codes 200–220 are a fraud hotspot." />
                <Field label="Days Since Last Transaction (D1)" name="D1" value={form.D1}
                  onChange={set} placeholder="e.g. 90"
                  description="How many days ago was the last transaction on this card? Less than 5 days = velocity attack. Normal = 30–300 days. Leave blank → 90 days assumed." />
              </div>
            </div>

            {/* KYC */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <User size={15} className="text-purple-500" />
                <span className="text-sm font-bold text-slate-800">KYC / Identity Verification</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="SSN Reuse Count" name="kyc_ssn_reuse_count" value={form.kyc_ssn_reuse_count}
                  onChange={set} placeholder="0"
                  description="How many different accounts use this same SSN? 0 = normal · 1 = borderline · 2+ = fraud ring · 4+ = critical" />
                <Field label="Phone Reuse Count" name="kyc_phone_reuse_count" value={form.kyc_phone_reuse_count}
                  onChange={set} placeholder="0"
                  description="How many accounts share this phone number? 0 = normal · 2+ = suspicious (synthetic identity)" />
                <Field label="Address / Card Ratio" name="addr_per_card_ratio" value={form.addr_per_card_ratio}
                  onChange={set} placeholder="e.g. 0.5"
                  description="Number of different addresses used per card. 0.1–1.0 = normal · 1.0–2.0 = review · 2.0+ = fraud ring" />
                <div />
                <div className="col-span-2">
                  <MatchToggle label="KYC Email vs Transaction Email" name="kyc_email_matches_tx"
                    value={form.kyc_email_matches_tx} onChange={set}
                    oneLabel="Emails match (safe)"
                    zeroLabel="Emails differ (red flag)"
                    description="Does the email in KYC records match the email used in this transaction? Mismatch = stolen identity signal." />
                </div>
              </div>
            </div>

            {/* Verification flags */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <CheckSquare size={15} className="text-emerald-500" />
                <span className="text-sm font-bold text-slate-800">Verification Match Flags</span>
                <span className="text-[10px] text-slate-400">1 = verified match · 0 = mismatch / unverified</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MatchToggle label="Phone Match (M4)" name="M4" value={form.M4} onChange={set}
                  oneLabel="Phone verified" zeroLabel="Phone mismatch"
                  description="Does the phone on file match what was submitted?" />
                <MatchToggle label="Email Match (M5)" name="M5" value={form.M5} onChange={set}
                  oneLabel="Email verified" zeroLabel="Email mismatch"
                  description="Does the email on file match?" />
                <MatchToggle label="Address Match (M6)" name="M6" value={form.M6} onChange={set}
                  oneLabel="Address verified" zeroLabel="Address mismatch"
                  description="Does the billing address match bank records?" />
              </div>
            </div>

            {/* Advanced */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <button type="button" onClick={() => setShowAdvanced(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition rounded-xl">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-slate-400" />
                  Advanced Fields
                  <span className="text-[10px] text-slate-400 font-normal">(C/D features, card details — all optional, safe defaults used)</span>
                </div>
                {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showAdvanced && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-4 space-y-3">
                  <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-[11px] text-blue-700">
                    💡 These are all optional. If blank, the model uses median values from 590K real transactions.
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="card2" name="card2" value={form.card2 ?? ''} onChange={set} placeholder="325"
                      description="Card bin number (100–600)" />
                    <Field label="card3" name="card3" value={form.card3 ?? ''} onChange={set} placeholder="185"
                      description="Card country code (150/185/224)" />
                    <Field label="card4 (network)" name="card4" value={form.card4 ?? ''} onChange={set} placeholder="1"
                      description="0=Visa · 1=Mastercard · 2=Amex · 3=Discover" />
                    <Field label="card5" name="card5" value={form.card5 ?? ''} onChange={set} placeholder="166"
                      description="Card product type (100–226)" />
                    <Field label="card6 (type)" name="card6" value={form.card6 ?? ''} onChange={set} placeholder="1"
                      description="0 = Credit · 1 = Debit" />
                    <Field label="dist1 (distance)" name="dist1" value={form.dist1 ?? ''} onChange={set} placeholder="23"
                      description="Miles between billing & shipping address. High = suspicious." />
                    <Field label="C1 (linked addresses)" name="C1" value={form.C1 ?? ''} onChange={set} placeholder="1"
                      description="How many addresses linked to this card. High = suspicious." />
                    <Field label="C2 (linked cards)" name="C2" value={form.C2 ?? ''} onChange={set} placeholder="1"
                      description="How many cards linked to this email" />
                    <Field label="C5 (linked devices)" name="C5" value={form.C5 ?? ''} onChange={set} placeholder="0"
                      description="How many devices used with this card" />
                    <Field label="D2 (days: addr change)" name="D2" value={form.D2 ?? ''} onChange={set} placeholder="150"
                      description="Days since last address change" />
                    <Field label="D10 (days: device)" name="D10" value={form.D10 ?? ''} onChange={set} placeholder="200"
                      description="Days since last device was seen" />
                    <Field label="DeviceType" name="DeviceType" value={form.DeviceType ?? ''} onChange={set} placeholder="0"
                      description="0 = Desktop · 1 = Mobile" />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
                <AlertTriangle size={13} /> {error}
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition shadow">
                {loading ? <><span className="animate-spin text-base">⟳</span> Analysing…</> : <><Send size={14} /> Run Fraud Check</>}
              </button>
              <button type="button" onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </form>

          {/* ── RESULT ── */}
          <div className="lg:col-span-2 space-y-4">

            {!result ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center py-20 text-center px-6 space-y-4">
                <ShieldOff className="h-12 w-12 text-slate-200" />
                <div>
                  <p className="text-sm font-semibold text-slate-400">Result appears here</p>
                  <p className="text-xs text-slate-300 mt-1">Fill the form or pick an example,<br />then click Run Fraud Check</p>
                </div>
                <div className="w-full space-y-1.5 text-left rounded-lg bg-white border border-slate-100 p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">What each score means</p>
                  {[
                    { range: '0–25%',  label: 'Low',      action: 'Allow',          color: 'bg-emerald-400' },
                    { range: '26–49%', label: 'Medium',   action: 'Flag for Review', color: 'bg-yellow-400' },
                    { range: '50–74%', label: 'High',     action: 'Manual Review',  color: 'bg-orange-400' },
                    { range: '75–100%',label: 'Critical', action: 'Freeze Txn',     color: 'bg-red-500'    },
                  ].map(s => (
                    <div key={s.range} className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${s.color}`} />
                      <span className="text-[10px] text-slate-500 w-14 tabular-nums">{s.range}</span>
                      <span className="text-[10px] font-semibold text-slate-700 w-14">{s.label}</span>
                      <span className="text-[10px] text-slate-400">{s.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Score card */}
                <div className={`rounded-xl border-2 ${cfg!.border} ${cfg!.bg} p-5 space-y-4`}>
                  <div className="flex items-center justify-between">
                    {cfg!.icon}
                    <span className={`text-xs font-bold uppercase tracking-widest ${cfg!.text}`}>
                      {result.risk_level} Risk
                    </span>
                  </div>
                  <div>
                    <div className={`text-4xl font-bold tabular-nums ${cfg!.text}`}>{pct}%</div>
                    <div className="text-xs text-slate-500 mt-0.5">Fraud probability</div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 w-full rounded-full bg-white/70 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>0% Safe</span><span>50%</span><span>100% Fraud</span>
                    </div>
                  </div>
                  <div className={`rounded-lg px-3 py-2.5 text-center font-bold text-sm ${
                    result.status === 'Safe'              ? 'bg-emerald-100 text-emerald-800' :
                    result.risk_level === 'Critical'      ? 'bg-red-100     text-red-800'     :
                    result.risk_level === 'High'          ? 'bg-orange-100  text-orange-800'  :
                                                            'bg-yellow-100  text-yellow-800'
                  }`}>
                    <Zap size={13} className="inline mr-1" />{result.recommended_action}
                  </div>
                </div>

                {/* Signals */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Fraud Signals Found</div>
                  {result.reasons.map((r, i) => (
                    <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed ${
                      r.includes('No strong') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      <span className="mt-0.5 shrink-0 font-bold">{r.includes('No strong') ? '✓' : '⚠'}</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>

                {/* Risk breakdown */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Risk Breakdown</div>
                  {[
                    { label: 'Identity Risk',  value: Math.min(100, (Number(form.kyc_ssn_reuse_count)/6)*100 + (form.kyc_email_matches_tx==='0' ? 40 : 0)), color: '#8b5cf6', desc: 'SSN reuse + email mismatch' },
                    { label: 'Velocity Risk',  value: form.D1 ? Math.max(0, 100-(Number(form.D1)/30)*100) : 10,                                            color: '#f59e0b', desc: `D1 = ${form.D1 || '90'} days` },
                    { label: 'Amount Risk',    value: Math.min(100, (Number(form.TransactionAmt)/12000)*100),                                               color: '#ef4444', desc: `$${Number(form.TransactionAmt).toLocaleString()}` },
                    { label: 'Overall Score',  value: pct,                                                                                                  color: barColor,  desc: 'Combined model output' },
                  ].map(b => (
                    <div key={b.label} className="mb-2.5">
                      <div className="flex justify-between items-baseline mb-1">
                        <div>
                          <span className="text-[11px] font-semibold text-slate-700">{b.label}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5">{b.desc}</span>
                        </div>
                        <span className="text-xs font-bold tabular-nums" style={{ color: b.color }}>{Math.round(Math.min(100,b.value))}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100,b.value)}%`, background: b.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
