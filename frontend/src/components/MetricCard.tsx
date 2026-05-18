import type { ReactNode } from 'react';

export default function MetricCard({
  label,
  value,
  change,
  changeType,
  icon,
}: {
  label: string;
  value: string;
  change: string;
  changeType: 'up' | 'down';
  icon?: ReactNode;
}) {
  const changeColor = changeType === 'up' ? 'text-risk-low' : 'text-risk-high';

  return (
    <div className="rounded-card border border-border-light dark:border-border-dark bg-white dark:bg-zinc-950 p-4 shadow-card" style={{ borderWidth: '0.5px' }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
        </div>
        {icon ? (
          <div className="rounded-lg bg-zinc-100 dark:bg-white/5 p-2 text-zinc-700 dark:text-zinc-200">
            {icon}
          </div>
        ) : null}
      </div>

      <div className="mt-3 text-sm">
        <span className={changeColor}>{change}</span>
        <span className="text-zinc-500 dark:text-zinc-400"> vs last period</span>
      </div>
    </div>
  );
}
