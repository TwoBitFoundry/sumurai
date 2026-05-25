import type { ReactNode } from 'react';
import { cn } from '@/ui/primitives';
import { HeaderAccountFilter } from './HeaderAccountFilter';

export function BottomContextualBar({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn('flex', 'w-full', 'min-w-0', 'max-w-full', 'items-center', 'gap-3')}
      data-testid="bottom-contextual-bar"
    >
      <div className={cn('shrink-0')}>
        <HeaderAccountFilter triggerStyle="icon-only" />
      </div>
      <div className={cn('min-w-0', 'flex-1')}>{children}</div>
    </div>
  );
}
