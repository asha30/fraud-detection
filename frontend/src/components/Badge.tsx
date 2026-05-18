import type { ReactNode } from 'react';

type BadgeVariant = 'high' | 'medium' | 'low' | 'safe';

const stylesByVariant: Record<BadgeVariant, string> = {
  high: 'bg-[#FCEBEB] text-[#A32D2D]',
  medium: 'bg-[#FAEEDA] text-[#854F0B]',
  low: 'bg-[#EAF3DE] text-[#3B6D11]',
  safe: 'bg-[#E1F5EE] text-[#0F6E56]',
};

export default function Badge({
  variant,
  children,
}: {
  variant: BadgeVariant;
  children: ReactNode;
}) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        stylesByVariant[variant],
      ].join(' ')}
    >
      {children}
    </span>
  );
}
