import { cn } from '@/ui/primitives';
import {
  effect as semanticEffects,
  status as semanticStatus,
  surface as semanticSurfaces,
} from '@/ui/recipes';
import { designTokens } from '@/ui/tokens';
import { fmtUSD } from '../../../utils/format';

const bp = {
  track: [
    'relative',
    'h-2.5',
    'overflow-hidden',
    'rounded-full',
    ...semanticSurfaces.mutedChip,
    'shadow-[inset_0_1px_2px_var(--color-effect-glass-shadow)]',
    'transition-colors',
    'duration-300',
    'dark:shadow-[inset_0_1px_2px_var(--color-effect-glass-shadow-dark)]',
  ],
  fill: {
    base: ['absolute', 'inset-y-0', 'left-0', 'rounded-full', 'transition-all', 'duration-500'],
    within: [
      'bg-gradient-to-r',
      'from-[var(--color-brand-sky)]',
      'via-[var(--color-brand-cyan)]',
      'to-[var(--color-brand-violet)]',
      ...semanticEffects.successGlow,
    ],
    over: [
      'bg-gradient-to-r',
      'from-[var(--color-brand-rose-dark)]',
      'via-[var(--color-brand-rose)]',
      'to-[var(--color-text-danger)]',
      ...semanticEffects.dangerGlow,
    ],
  },
  caption: {
    row: [
      'flex',
      'items-center',
      'justify-between',
      'text-[0.75rem]',
      designTokens.text.muted,
      'transition-colors',
      'duration-300',
    ],
    percent: ['font-medium', 'tracking-wide'],
    summaryWithin: ['font-semibold', designTokens.text.body],
    summaryOver: ['font-semibold', ...semanticStatus.danger.text],
  },
} as const;

export function BudgetProgress({ amount, spent }: { amount: number; spent: number }) {
  const percent = amount > 0 ? (spent / amount) * 100 : 0;
  const isOver = spent > amount;
  const remaining = Math.max(0, amount - spent);
  return (
    <div className="space-y-2.5">
      <div className={cn(bp.track)}>
        <div
          className={cn(bp.fill.base, isOver ? bp.fill.over : bp.fill.within)}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className={cn(bp.caption.row)}>
        <span className={cn(bp.caption.percent)}>{percent.toFixed(0)}% used</span>
        <span className={cn(isOver ? bp.caption.summaryOver : bp.caption.summaryWithin)}>
          {isOver ? `-${fmtUSD(spent - amount)} over` : `${fmtUSD(remaining)} left`}
        </span>
      </div>
    </div>
  );
}

export default BudgetProgress;
