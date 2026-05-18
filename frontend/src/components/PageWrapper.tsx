import type { ReactNode } from 'react';

export default function PageWrapper({ children }: { children: ReactNode }) {
  return <div className="p-5">{children}</div>;
}
