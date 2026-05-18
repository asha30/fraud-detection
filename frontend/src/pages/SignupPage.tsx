import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import {
  Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, User, UserPlus,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
    mode: 'onSubmit',
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signup(values.name, values.email, values.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Signup failed');
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
        {/* Left panel */}
        <section className="relative flex w-full flex-col justify-center px-6 pb-10 pt-10 lg:w-[55%] lg:px-12 lg:pb-12 lg:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/25">
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
              </div>
              <div className="text-base font-semibold tracking-tight text-slate-950">FraudShield AI</div>
            </div>

            <h1 className="mt-10 max-w-xl text-balance text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">
              Join the Fraud Detection Platform
            </h1>
            <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-slate-700/80 sm:text-base">
              Create your analyst account to start monitoring transactions and detecting fraud in real time.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: 'Model accuracy', value: '99.2%' },
                { label: 'Transactions / day', value: '2.4M+' },
                { label: 'Fraud alerts caught', value: '1,274' },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-slate-900/10 bg-white/40 px-4 py-3 backdrop-blur">
                  <div className="text-[11px] font-medium text-slate-700/80">{m.label}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-950">{m.value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Right panel */}
        <section className="relative flex w-full items-center justify-center px-6 py-10 lg:w-[45%] lg:px-10">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05, ease: 'easeOut' }}
          >
            <div className="rounded-2xl border border-slate-900/10 bg-white/55 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:p-8">
              <div className="text-2xl font-semibold tracking-tight text-slate-950">Create account</div>
              <div className="mt-2 text-sm leading-relaxed text-slate-700/80">
                Sign up to access the fraud monitoring console.
              </div>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                {/* Name */}
                <div className="space-y-2">
                  <label htmlFor="name" className="text-xs font-medium text-slate-700">Full name</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="name"
                      type="text"
                      placeholder="Jane Analyst"
                      autoComplete="name"
                      {...register('name')}
                      className="h-11 w-full rounded-xl border border-slate-900/10 bg-white/60 pl-10 pr-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none transition hover:bg-white/75 focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/15"
                    />
                  </div>
                  {errors.name?.message && <div className="text-xs text-red-600">{errors.name.message}</div>}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-xs font-medium text-slate-700">Email</label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="email"
                      type="email"
                      placeholder="analyst@bank.com"
                      autoComplete="email"
                      {...register('email')}
                      className="h-11 w-full rounded-xl border border-slate-900/10 bg-white/60 pl-10 pr-3 text-sm text-slate-950 placeholder:text-slate-400 outline-none transition hover:bg-white/75 focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/15"
                    />
                  </div>
                  {errors.email?.message && <div className="text-xs text-red-600">{errors.email.message}</div>}
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label htmlFor="password" className="text-xs font-medium text-slate-700">Password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      {...register('password')}
                      className="h-11 w-full rounded-xl border border-slate-900/10 bg-white/60 pl-10 pr-11 text-sm text-slate-950 outline-none transition hover:bg-white/75 focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/15"
                    />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-900/5">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password?.message && <div className="text-xs text-red-600">{errors.password.message}</div>}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-xs font-medium text-slate-700">Confirm password</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      {...register('confirmPassword')}
                      className="h-11 w-full rounded-xl border border-slate-900/10 bg-white/60 pl-10 pr-11 text-sm text-slate-950 outline-none transition hover:bg-white/75 focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/15"
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-900/5">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword?.message && <div className="text-xs text-red-600">{errors.confirmPassword.message}</div>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-80"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {isSubmitting ? 'Creating account…' : 'Create account'}
                </button>

                {submitError && (
                  <div className="text-xs text-red-600">{submitError}</div>
                )}

                <div className="text-center text-xs text-slate-600">
                  Already have an account?{' '}
                  <Link to="/login" className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline underline-offset-4">
                    Sign in
                  </Link>
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
