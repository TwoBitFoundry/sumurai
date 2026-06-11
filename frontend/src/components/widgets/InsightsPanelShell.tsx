import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/ui/primitives';
import { type HeroAccent, heroAccents } from '@/ui/tokens';

export interface InsightsPanelShellProps {
  testId: string;
  accent: HeroAccent;
  className?: string;
  children: ReactNode;
}

export function InsightsPanelShell({
  testId,
  accent,
  className,
  children,
}: InsightsPanelShellProps) {
  const shellAccent = heroAccents[accent];
  const hoverInsetRingStyle = {
    boxShadow: `inset 0 0 0 2px ${shellAccent.ringHex}`,
  } as CSSProperties;

  return (
    <section
      data-testid={testId}
      className={cn(
        'group',
        'relative',
        'overflow-hidden',
        'rounded-[0.75rem]',
        'border-0',
        'bg-white/80',
        'transition-colors',
        'duration-200',
        'dark:bg-[#111a2f]/70',
        className
      )}
    >
      <div
        className={cn(
          'hero-stat-card__gradient',
          'pointer-events-none',
          'absolute',
          'inset-0',
          'rounded-[inherit]',
          'opacity-100'
        )}
        style={{
          backgroundImage: `linear-gradient(135deg, ${shellAccent.gradFrom}33, ${shellAccent.gradVia}1f, transparent 70%)`,
        }}
      />
      <div
        aria-hidden
        className={cn(
          'hero-stat-card__inset-ring',
          'pointer-events-none',
          'absolute',
          'inset-0',
          'z-[1]',
          'rounded-[inherit]',
          'opacity-0',
          'transition-opacity',
          'duration-200',
          'group-hover:opacity-100'
        )}
        style={hoverInsetRingStyle}
      />
      {children}
    </section>
  );
}

export default InsightsPanelShell;
