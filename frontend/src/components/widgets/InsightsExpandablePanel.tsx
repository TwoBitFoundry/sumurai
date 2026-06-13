import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/ui/primitives';
import { insightsPanel as uiInsightsPanelRecipes } from '@/ui/recipes';

const EXPAND_TRANSITION = { duration: 0.24, ease: [0.22, 0.61, 0.36, 1] } as const;

export interface InsightsExpandablePanelProps {
  testId: string;
  bodyId: string;
  bodyTestId: string;
  summaryLabel: string;
  summary: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
  bodyClassName?: string;
}

export function InsightsExpandablePanel({
  testId,
  bodyId,
  bodyTestId,
  summaryLabel,
  summary,
  expanded,
  onToggle,
  children,
  bodyClassName,
}: InsightsExpandablePanelProps) {
  return (
    <div data-testid={testId}>
      <div className={cn('relative', 'z-10', 'px-3', 'py-1.5', 'md:px-4', 'md:py-2')}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={summaryLabel}
          title={summaryLabel}
          onClick={onToggle}
          className={cn('w-full', 'text-left')}
        >
          {summary}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={bodyId}
            data-testid={bodyTestId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={EXPAND_TRANSITION}
            className={cn('relative', 'z-10')}
          >
            <div className={cn('px-3', 'md:px-4')}>
              <div className={cn('border-t', ...uiInsightsPanelRecipes.labelDivider)} />
            </div>
            <div className={cn('px-3', 'py-2', 'md:px-4', 'md:py-3', bodyClassName)}>
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default InsightsExpandablePanel;
