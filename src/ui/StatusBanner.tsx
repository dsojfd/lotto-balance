import type { ReactNode } from 'react';

interface StatusBannerProps {
  children: ReactNode;
  tone?: 'info' | 'error';
}

export function StatusBanner({ children, tone = 'info' }: StatusBannerProps) {
  return <p className={`status-banner status-banner--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</p>;
}
