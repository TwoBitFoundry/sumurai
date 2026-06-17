import type { ReactNode } from 'react';
import { cn } from '@/ui/primitives';
import { HeaderAccountFilter } from './HeaderAccountFilter';

const contextualControlsRow = [
  'flex',
  'w-fit',
  'max-w-full',
  'mx-auto',
  'items-center',
  'gap-3',
] as const;

export function BottomContextualBar({
  children,
  topContent,
}: {
  children: ReactNode;
  topContent?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex',
        'w-full',
        'min-w-0',
        'max-w-full',
        'flex-col',
        topContent ? 'gap-1.5' : undefined
      )}
      data-testid="bottom-contextual-bar"
    >
      {topContent ? (
        <div
          className={cn('w-full', 'min-w-0', 'max-w-full', 'overflow-hidden')}
          data-testid="bottom-contextual-bar-top"
        >
          {topContent}
        </div>
      ) : null}
      <div className={cn(...contextualControlsRow)} data-testid="bottom-contextual-bar-controls">
        <div className={cn('shrink-0')}>
          <HeaderAccountFilter triggerStyle="icon-only" />
        </div>
        <div className={cn('min-w-0', 'shrink-0')}>{children}</div>
      </div>
    </div>
  );
}
