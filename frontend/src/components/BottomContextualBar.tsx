import type { ReactNode } from 'react';
import { cn } from '@/ui/primitives';
import { HeaderAccountFilter } from './HeaderAccountFilter';

export const floatingControlBarRecipes = {
  row: ['gap-2'],
} as const;

export function BottomContextualBar({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex',
        'min-w-0',
        'max-w-full',
        'items-stretch',
        ...floatingControlBarRecipes.row
      )}
      data-testid="bottom-contextual-bar"
    >
      <HeaderAccountFilter triggerStyle="icon-only" />
      <div className={cn('min-w-0', 'flex-1')}>{children}</div>
    </div>
  );
}
