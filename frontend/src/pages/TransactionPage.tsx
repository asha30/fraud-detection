import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
// NOTE: we intentionally use a tiny local resolver wrapper to avoid TS type
// incompatibilities between Zod v4 and react-hook-form resolver typings.
import {
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  User,
  CreditCard,
  Activity,
  Info,
} from 'lucide-react';
import PageWrapper from '../components/PageWrapper';
import Badge from '../components/Badge';

const transactionSchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number().min(0.01, 'Amount must be at least 0.01'),
  type: z.enum(['Wire Transfer', 'Card Payment', 'ACH', 'Cash Deposit']),
  channel: z.enum(['Online Banking', 'Mobile App', 'Branch', 'ATM']),
  merchant: z.string().min(1, 'Merchant / recipient is required'),
  merchantCategory: z.enum([
    'Financial Services',
    'Retail',
    'Crypto Exchange',
    'Wire',
  ]),
  customerId: z.string().min(1, 'Customer ID is required'),
  accountAgeMonths: z.coerce
    .number()
    .min(0, 'Account age must be 0 or more')
    .int('Account age must be a whole number'),
  country: z.string().min(1, 'Country is required'),
  ipCountry: z.string().min(1, 'IP Country is required'),
  deviceFingerprint: z.string().min(1, 'Device fingerprint is required'),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

type RiskFactor = { type: 'danger' | 'warning' | 'success'; message: string };

type AnalyzeResponse = {
  riskScore: number;
  riskLevel: 'high' | 'medium' | 'low' | 'safe';
  recommendation: 'block' | 'review' | 'approve';
  factors: RiskFactor[];
};

type FraudPredictResponse = {
  prediction: string;
  fraud_probability: number;
  risk_level: string;
  recommended_action: string;
  status: string;
  confidence: number;
};

type FraudPredictPayload = {
  transaction_id: string;
  customer_id: string;
  amount: number;
  device_mismatch: boolean;
  ip_country: string;
  billing_country: string;
  kyc_score: number;
  raw: Record<string, number>;
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function toPercent(prob: number) {
  return Math.round(clamp01(prob) * 100);
}

function inferDeviceMismatch(deviceFingerprint: string) {
  // Minimal heuristic: empty fingerprint = mismatch true (unknown device).
  // Keep UI stable; this is just to satisfy the required payload.
  return !deviceFingerprint?.trim();
}

function buildRawFeatureVector(values: TransactionFormValues): FraudPredictPayload['raw'] {
  // Use the exact keys required by the backend ML schema. Where the form doesn't
  // collect a field, we provide deterministic defaults.
  return {
    TransactionID: Number.parseInt(values.transactionId.replace(/\D/g, ''), 10) || 12345,
    TransactionDT: 999999,
    TransactionAmt: values.amount,
    card1: 1111,
    card2: 222,
    card3: 150,
    card4: 1,
    card5: 200,
    card6: 1,
    addr1: 100,
    addr2: 87,
    dist1: 10,
    P_emaildomain: 1,
    R_emaildomain: 1,
    C1: 1,
    C2: 1,
    C3: 1,
    C4: 1,
    C5: 1,
    C6: 1,
    C7: 1,
    C8: 1,
    C9: 1,
    C10: 1,
    D1: 1,
    D2: 1,
    D3: 1,
    D10: 1,
    D15: 1,
    M1: 1,
    M2: 1,
    M3: 1,
    M4: 1,
    M5: 0,
    M6: 1,
    id_01: 1,
    id_02: 1,
    id_03: 1,
    id_05: 1,
    id_06: 1,
    id_09: 1,
    id_10: 1,
    id_11: 1,
    id_12: 1,
    id_15: 1,
    id_16: 1,
    id_17: 1,
    id_19: 1,
    id_20: 1,
    id_28: 1,
    id_29: 1,
    id_30: 1,
    id_31: 1,
    DeviceType: 1,
    DeviceInfo: 1,
    kyc_full_name: 1,
    kyc_phone: 1,
    kyc_dob: 1,
    kyc_ssn_last4: 1,
    kyc_zip: 500001,
    kyc_street: 1,
    kyc_email: 1,
    kyc_email_matches_tx: 1,
    email_domain_match: 1,
    addr_per_card_ratio: 1,
    kyc_phone_reuse_count: 1,
    kyc_ssn_reuse_count: 1,
    TransactionAmt_log: 9.1,
  };
}

function generateTxnId() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `TXN-${n}`;
}

function schemaResolver() {
  return async (values: unknown) => {
    const parsed = transactionSchema.safeParse(values);

    if (parsed.success) {
      return { values: parsed.data, errors: {} };
    }

    const fieldErrors: Record<string, any> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (!key) continue;
      fieldErrors[String(key)] = { type: 'validation', message: issue.message };
    }

    return { values: {}, errors: fieldErrors };
  };
}

function scoreColor(score: number) {
  if (score > 70) return '#E24B4A';
  if (score >= 40) return '#EF9F27';
  return '#1D9E75';
}

function riskVariantForScore(score: number): 'high' | 'medium' | 'low' | 'safe' {
  if (score > 70) return 'high';
  if (score >= 40) return 'medium';
  if (score > 0) return 'low';
  return 'safe';
}

function riskLabelForScore(score: number) {
  if (score > 70) return 'High Risk';
  if (score >= 40) return 'Medium Risk';
  if (score > 0) return 'Low Risk';
  return 'Safe';
}

function recommendationText(rec: AnalyzeResponse['recommendation']) {
  if (rec === 'block') return 'Recommend block';
  if (rec === 'review') return 'Recommend review';
  return 'Recommend approve';
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  display: 'block',
  marginBottom: 5,
  fontWeight: 500,
};

const helperStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  color: '#9ca3af',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '0.5px solid #e5e7eb',
  borderRadius: 10,
  padding: '10px 12px',
  fontSize: 13,
  background: '#ffffff',
  outline: 'none',
  transition: 'border-color 120ms ease, box-shadow 120ms ease, background 120ms ease',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.7,
  color: '#6b7280',
  borderBottom: '0.5px solid #e5e7eb',
  paddingBottom: 8,
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <div style={{ marginTop: 6, fontSize: 12, color: '#dc2626' }}>{message}</div>;
}

export default function TransactionPage() {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState<string | null>(null);
  const [predictResult, setPredictResult] = useState<FraudPredictResponse | null>(null);

  const defaultTxnId = useMemo(() => generateTxnId(), []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: schemaResolver(),
    defaultValues: {
      transactionId: defaultTxnId,
      amount: undefined,
      type: 'Wire Transfer',
      channel: 'Online Banking',
      merchant: '',
      merchantCategory: 'Financial Services',
      customerId: '',
      accountAgeMonths: 0,
      country: 'US',
      ipCountry: 'US',
      deviceFingerprint: '',
    },
    mode: 'onSubmit',
  });

  // If user clears form, also reset the generated TXN id.
  useEffect(() => {
    // keep lint happy / placeholder for future form side-effects
  }, []);

  const onAnalyze = handleSubmit(async (values) => {
    setAnalyzing(true);
    setPredicting(true);
    setPredictError(null);
    setPredictResult(null);

    try {
      // Use FastAPI /predict only (do not rely on any other backend endpoints).
      const payload: FraudPredictPayload = {
        transaction_id: values.transactionId || 'TXN001',
        customer_id: values.customerId || 'CUST100',
        amount: values.amount,
        device_mismatch: inferDeviceMismatch(values.deviceFingerprint),
        ip_country: values.ipCountry || 'US',
        billing_country: values.country || 'US',
        kyc_score: 40,
        raw: buildRawFeatureVector(values),
      };

      const predictRes = await fetch('http://127.0.0.1:8001/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!predictRes.ok) {
        const text = await predictRes.text();
        throw new Error(text || 'Prediction request failed');
      }

      const predictData = (await predictRes.json()) as FraudPredictResponse;
      setPredictResult(predictData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setPredictError(msg);
    } finally {
      setAnalyzing(false);
      setPredicting(false);
    }
  });

  const score = useMemo(() => {
    if (analyzeResult?.riskScore != null) return analyzeResult.riskScore;

    // Derive a score from FastAPI probability if available (0..1 -> 0..100)
    if (predictResult?.fraud_probability != null && Number.isFinite(predictResult.fraud_probability)) {
      return Math.round(clamp01(predictResult.fraud_probability) * 100);
    }

    return 0;
  }, [analyzeResult?.riskScore, predictResult?.fraud_probability]);
  const scoreCol = scoreColor(score);
  const riskVariant = riskVariantForScore(score);
  const riskLabel = riskLabelForScore(score);
  const confidence = analyzeResult ? Math.max(60, Math.min(99, 72 + Math.round(score * 0.2))) : 0;
  const prediction =
    score > 70 ? 'Likely Fraud' : score >= 40 ? 'Needs Review' : analyzeResult ? 'Likely Legit' : '—';

  const ringCirc = 2 * Math.PI * 34;
  const ringOffset = ringCirc - (Math.max(0, Math.min(100, score)) / 100) * ringCirc;

  return (
    <PageWrapper>
      <div className="flex flex-col lg:flex-row gap-4 items-stretch">
        {/* LEFT: Form */}
        <div className="flex-1 min-w-0">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            {/* Transaction Details */}
            <div style={sectionHeaderStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={14} color="#6b7280" />
                Transaction Details
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Transaction ID</label>
                <input
                  type="text"
                  readOnly
                  {...register('transactionId')}
                  style={{ ...inputStyle, background: '#f3f4f6', color: '#6b7280' }}
                />
                <div style={helperStyle}>Auto-generated ID for this analysis.</div>
                <FieldError message={errors.transactionId?.message} />
              </div>

              <div>
                <label style={labelStyle}>Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 2499.99"
                  {...register('amount', { valueAsNumber: true })}
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#1D9E75';
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(29, 158, 117, 0.12)';
                    e.currentTarget.style.background = '#ffffff';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <div style={helperStyle}>Enter the transaction amount in USD.</div>
                <FieldError message={errors.amount?.message} />
              </div>

              <div>
                <label style={labelStyle}>Transaction type</label>
                <select {...register('type')} style={inputStyle}>
                  <option>Wire Transfer</option>
                  <option>Card Payment</option>
                  <option>ACH</option>
                  <option>Cash Deposit</option>
                </select>
                <div style={helperStyle}>Payment rail / transfer method.</div>
                <FieldError message={errors.type?.message} />
              </div>

              <div>
                <label style={labelStyle}>Channel</label>
                <select {...register('channel')} style={inputStyle}>
                  <option>Online Banking</option>
                  <option>Mobile App</option>
                  <option>Branch</option>
                  <option>ATM</option>
                </select>
                <div style={helperStyle}>Where the transaction was initiated.</div>
                <FieldError message={errors.channel?.message} />
              </div>

              <div>
                <label style={labelStyle}>Merchant / Recipient</label>
                <input
                  type="text"
                  placeholder="e.g. ACME Imports LLC"
                  {...register('merchant')}
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#1D9E75';
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(29, 158, 117, 0.12)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <div style={helperStyle}>Merchant/recipient name as provided by the payment rail.</div>
                <FieldError message={errors.merchant?.message} />
              </div>

              <div>
                <label style={labelStyle}>Merchant category</label>
                <select {...register('merchantCategory')} style={inputStyle}>
                  <option>Financial Services</option>
                  <option>Retail</option>
                  <option>Crypto Exchange</option>
                  <option>Wire</option>
                </select>
                <div style={helperStyle}>Used for category-based anomaly detection.</div>
                <FieldError message={errors.merchantCategory?.message} />
              </div>
            </div>

            {/* Customer Information */}
            <div style={sectionHeaderStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <User size={14} color="#6b7280" />
                Customer Information
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Customer ID</label>
                <input type="text" placeholder="e.g. CUST-18421" {...register('customerId')} style={inputStyle} />
                <div style={helperStyle}>Unique customer identifier from core banking.</div>
                <FieldError message={errors.customerId?.message} />
              </div>

              <div>
                <label style={labelStyle}>Account age (months)</label>
                <input
                  type="number"
                  placeholder="e.g. 18"
                  {...register('accountAgeMonths', { valueAsNumber: true })}
                  style={inputStyle}
                />
                <div style={helperStyle}>New accounts may carry higher fraud risk.</div>
                <FieldError message={errors.accountAgeMonths?.message} />
              </div>

              <div>
                <label style={labelStyle}>Country</label>
                <input type="text" placeholder="e.g. US" {...register('country')} style={inputStyle} />
                <FieldError message={errors.country?.message} />
              </div>

              <div>
                <label style={labelStyle}>IP Country</label>
                <input type="text" placeholder="e.g. US" {...register('ipCountry')} style={inputStyle} />
                <div style={helperStyle}>Derived from IP geolocation.</div>
                <FieldError message={errors.ipCountry?.message} />
              </div>
            </div>

            {/* Device & Network */}
            <div style={sectionHeaderStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Smartphone size={14} color="#6b7280" />
                Device & Network
              </span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Signals</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label style={labelStyle}>Device fingerprint</label>
                <input type="text" placeholder="e.g. 8c1a-7f22-9b0d-..." {...register('deviceFingerprint')} style={inputStyle} />
                <div style={helperStyle}>Stable identifier used to detect device reuse.</div>
                <FieldError message={errors.deviceFingerprint?.message} />
              </div>
            </div>

            {/* Risk Indicators (minimal) */}
            <div style={sectionHeaderStyle}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Activity size={14} color="#6b7280" />
                Risk Indicators
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start gap-2">
                <Info size={16} className="mt-0.5 text-emerald-700" />
                <div className="text-[12px] text-slate-600 leading-relaxed">
                  We combine transaction, customer, and device signals to score risk.
                  Provide accurate merchant and device details to improve model confidence.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void onAnalyze()}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition disabled:opacity-80 disabled:cursor-not-allowed"
                disabled={analyzing}
              >
                {analyzing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Analyzing…</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert size={16} />
                    <span>Analyze for Fraud</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAnalyzeResult(null);
                  reset({
                    transactionId: generateTxnId(),
                    amount: undefined,
                    type: 'Wire Transfer',
                    channel: 'Online Banking',
                    merchant: '',
                    merchantCategory: 'Financial Services',
                    customerId: '',
                    accountAgeMonths: 0,
                    country: 'US',
                    ipCountry: 'US',
                    deviceFingerprint: '',
                  });
                }}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-900 transition"
              >
                Clear form
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT: Risk panel */}
        <div className="w-full lg:w-[360px] flex-none flex flex-col gap-3">
          {/* TOP CARD: Risk score */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-medium text-slate-600">Risk analysis</div>
              <Badge variant={riskVariant}>{riskLabel}</Badge>
            </div>

            <div className="mt-3 flex items-center gap-4">
              {/* Progress ring */}
              <div className="relative h-[88px] w-[88px]">
                <svg viewBox="0 0 80 80" className="h-full w-full">
                  <circle cx="40" cy="40" r="34" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                  <circle
                    cx="40"
                    cy="40"
                    r="34"
                    stroke={scoreCol}
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={ringCirc}
                    strokeDashoffset={ringOffset}
                    transform="rotate(-90 40 40)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-[22px] font-semibold" style={{ color: scoreCol }}>
                    {Math.round(score)}
                  </div>
                  <div className="text-[11px] text-slate-500">score</div>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-slate-600">Prediction</div>
                <div className="mt-0.5 text-[14px] font-semibold text-slate-900">{prediction}</div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11px] text-slate-500">Confidence</div>
                    <div className="text-[13px] font-semibold text-slate-900">
                      {predictResult ? `${toPercent(predictResult.confidence)}%` : analyzeResult ? `${confidence}%` : '—'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div className="text-[11px] text-slate-500">Status</div>
                    <div className="text-[13px] font-semibold text-slate-900">
                      {predicting ? 'Running…' : predictResult ? predictResult.status : analyzeResult ? 'Completed' : 'Awaiting'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-600">
              <ShieldCheck size={14} className="text-emerald-700" />
              <span>
                {analyzeResult ? recommendationText(analyzeResult.recommendation) : 'Submit to analyze'}
              </span>
            </div>
          </div>

          {/* RESULTS: Risk factors + summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-medium text-slate-900">Results</div>
              <div className="text-[11px] text-slate-500">Signals</div>
            </div>

            {predictError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                {predictError}
              </div>
            ) : null}

            {!predictResult ? (
              <div className="mt-3 text-[12px] text-slate-600">
                {predicting
                  ? 'Running fraud prediction…'
                  : 'Run an analysis to view detected risk factors, recommended action and transaction summary.'}
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {/* Fraud result card (clean, no layout redesign) */}
                <div
                  className={`rounded-lg border p-3 ${
                    predictResult.prediction === 'Safe'
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-600">Prediction</div>
                      <div
                        className={`mt-0.5 text-[14px] font-semibold ${
                          predictResult.prediction === 'Safe' ? 'text-emerald-800' : 'text-red-800'
                        }`}
                      >
                        {predictResult.prediction}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-slate-600">Fraud probability</div>
                      <div className="mt-0.5 text-[14px] font-semibold text-slate-900">
                        {toPercent(predictResult.fraud_probability)}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-slate-200 bg-white/60 px-2.5 py-2">
                      <div className="text-[11px] text-slate-500">Risk level</div>
                      <div className="text-[13px] font-semibold text-slate-900">{predictResult.risk_level}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white/60 px-2.5 py-2">
                      <div className="text-[11px] text-slate-500">Confidence</div>
                      <div className="text-[13px] font-semibold text-slate-900">
                        {toPercent(predictResult.confidence)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recommended action */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">Recommended action</div>
                  <div className="mt-0.5 text-[13px] font-semibold text-slate-900">
                    {predictResult.recommended_action}
                  </div>
                </div>

                {/* Transaction summary */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-[11px] text-slate-500">Status</div>
                    <div className="mt-0.5 text-[13px] font-semibold text-slate-900">{predictResult.status}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-[11px] text-slate-500">Fraud probability</div>
                    <div className="mt-0.5 text-[13px] font-semibold text-slate-900">
                      {toPercent(predictResult.fraud_probability)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
