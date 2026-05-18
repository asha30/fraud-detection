import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  ShieldHalf,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function MetricCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend: string;
}) {
  return (
    <div className="rounded-xl border border-slate-900/10 bg-white/40 px-4 py-3 shadow-[0_0_0_1px_rgba(15,23,42,0.06)_inset] backdrop-blur">
      <div className="text-[11px] font-medium tracking-wide text-slate-700/80">
        {label}
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="text-lg font-semibold text-slate-950">{value}</div>
        <div className="text-[11px] font-medium text-emerald-700/90">
          {trend}
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        'inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/40 px-3 py-1 text-[11px] font-medium text-slate-800/80 shadow-[0_0_0_1px_rgba(15,23,42,0.05)_inset] backdrop-blur ' +
        (className ?? '')
      }
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500/40 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
      </span>
      {children}
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: true,
    },
    mode: 'onSubmit',
  });

  const buttonLabel = useMemo(
    () => (isSubmitting ? 'Signing in...' : 'Sign in'),
    [isSubmitting],
  );

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values.email, values.password);
      navigate('/dashboard', { replace: true });
    } catch {
      setSubmitError('Invalid credentials');
    }
  });

  return (
    <div className="min-h-screen w-full overflow-hidden bg-slate-50 text-slate-950">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-white/80 via-slate-50/60 to-slate-100/80" />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_8%_12%,rgba(16,185,129,0.16),transparent_55%),radial-gradient(900px_circle_at_86%_82%,rgba(34,211,238,0.12),transparent_55%)]" />
        <div className="absolute -left-48 -top-48 h-[560px] w-[560px] rounded-full bg-emerald-400/18 blur-3xl" />
        <div className="absolute -bottom-56 -right-48 h-[620px] w-[620px] rounded-full bg-cyan-400/16 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(to_right,rgba(15,23,42,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.10)_1px,transparent_1px)] [background-size:56px_56px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1400px] flex-col lg:flex-row">
        {/* Left panel (55%) */}
        <section className="relative flex w-full flex-col justify-between px-6 pb-10 pt-10 lg:w-[55%] lg:px-12 lg:pb-12 lg:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/25">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="text-base font-semibold tracking-tight text-slate-950">
                FraudShield AI
              </div>
            </div>

            <h1 className="mt-10 max-w-xl text-balance text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
              AI-Powered Fraud Detection Platform
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-slate-700/80 sm:text-base">
              Real-time transaction monitoring, anomaly detection and fraud
              intelligence.
            </p>

            {/* Status indicators */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <StatusPill>Live Monitoring Active</StatusPill>
              <StatusPill className="[--pulse:rgba(34,211,238,0.7)]">
                Threat Intelligence Enabled
              </StatusPill>
            </div>

            {/* Metrics */}
            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard
                label="Transactions monitored today"
                value="2,483,911"
                trend="+12.4%"
              />
              <MetricCard
                label="Fraud alerts detected"
                value="1,274"
                trend="Live"
              />
              <MetricCard
                label="Detection accuracy"
                value="99.2%"
                trend="Model v3"
              />
            </div>
          </motion.div>

          {/* Security visual */}
          <motion.div
            className="relative mt-12 hidden lg:block"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12, ease: 'easeOut' }}
          >
            <motion.div
              className="relative overflow-hidden rounded-2xl border border-slate-900/10 bg-white/45 p-6 shadow-[0_0_0_1px_rgba(15,23,42,0.06)_inset] backdrop-blur"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <ShieldHalf className="h-4 w-4 text-emerald-700" />
                  Security Posture
                </div>
                <div className="text-[11px] font-medium text-slate-700/60">
                  SOC feed
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/35 px-3 py-3 ring-1 ring-slate-900/10">
                  <div className="text-[11px] font-medium text-slate-700/70">
                    Risk index
                  </div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">
                    18
                  </div>
                </div>
                <div className="rounded-xl bg-white/35 px-3 py-3 ring-1 ring-slate-900/10">
                  <div className="text-[11px] font-medium text-slate-700/70">
                    Signals
                  </div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">
                    312
                  </div>
                </div>
                <div className="rounded-xl bg-white/35 px-3 py-3 ring-1 ring-slate-900/10">
                  <div className="text-[11px] font-medium text-slate-700/70">
                    Response
                  </div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">
                    97%
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-white/30 px-3 py-2 ring-1 ring-slate-900/10"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-600" />
                      <div className="text-[12px] font-medium text-slate-800">
                        Stream #{i} verified
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500">just now</div>
                  </div>
                ))}
              </div>

              <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-500/14 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-24 h-64 w-64 rounded-full bg-cyan-500/12 blur-3xl" />
            </motion.div>
          </motion.div>
        </section>

        {/* Right panel (45%) */}
        <section className="relative flex w-full items-center justify-center px-6 py-10 lg:w-[45%] lg:px-10">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05, ease: 'easeOut' }}
          >
            <div className="rounded-2xl border border-slate-900/10 bg-white/55 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:p-8">
              <div>
                <div className="text-2xl font-semibold tracking-tight text-slate-950">
                  Welcome back
                </div>
                <div className="mt-2 text-sm leading-relaxed text-slate-700/80">
                  Sign in to access the fraud monitoring console.
                </div>
              </div>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                {/* Email */}
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="text-xs font-medium text-slate-700"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="email"
                      type="email"
                      placeholder="analyst@bank.com"
                      autoComplete="email"
                      {...register('email')}
                      className="h-11 w-full rounded-xl border border-slate-900/10 bg-white/60 pl-10 pr-3 text-sm text-slate-950 placeholder:text-slate-400 shadow-[0_0_0_1px_rgba(15,23,42,0.04)_inset] outline-none transition hover:bg-white/75 focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/15"
                    />
                  </div>
                  {errors.email?.message ? (
                    <div className="text-xs text-red-600">
                      {errors.email.message}
                    </div>
                  ) : null}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="text-xs font-medium text-slate-700"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      {...register('password')}
                      className="h-11 w-full rounded-xl border border-slate-900/10 bg-white/60 pl-10 pr-11 text-sm text-slate-950 placeholder:text-slate-400 shadow-[0_0_0_1px_rgba(15,23,42,0.04)_inset] outline-none transition hover:bg-white/75 focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-900/5 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password?.message ? (
                    <div className="text-xs text-red-600">
                      {errors.password.message}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      {...register('rememberMe')}
                      className="h-4 w-4 rounded border-slate-900/20 bg-white text-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                    />
                    Remember me
                  </label>

                  <a
                    href="#"
                    className="text-xs font-medium text-emerald-700 underline-offset-4 transition hover:text-emerald-800 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:translate-y-0"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogIn className="h-4 w-4" />
                  )}
                  {buttonLabel}
                </button>

                {submitError ? (
                  <div className="text-xs text-red-600">{submitError}</div>
                ) : null}

                <div className="text-center text-xs text-slate-600">
                  Don't have an account?{' '}
                  <Link to="/signup" className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline underline-offset-4">
                    Sign up
                  </Link>
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-slate-900/10 bg-white/45 px-3 py-2 text-[11px] leading-relaxed text-slate-700/80">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
                  <div>
                    MFA is enforced for all analyst accounts. You may be prompted
                    to verify a second factor after sign-in.
                  </div>
                </div>
              </form>
            </div>

            <div className="mt-4 text-center text-[11px] text-slate-600/80">
              Protected access • Audit logging • Session risk scoring
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  );
}
