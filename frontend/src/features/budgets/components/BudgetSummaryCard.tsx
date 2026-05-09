import { cn } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';
import { fmtUSD } from '../../../utils/format';
import BudgetProgress from './BudgetProgress';

interface BudgetSummaryCardProps {
  totalBudgeted: number;
  totalSpent: number;
}

export const BudgetSummaryCard = ({ totalBudgeted, totalSpent }: BudgetSummaryCardProps) => {
  const overBudget = totalSpent > totalBudgeted;

  return (
    <div
      className={cn(
        'group',
        'relative',
        'overflow-hidden',
        'rounded-2xl',
        'border-2',
        'border-slate-200',
        'bg-white/80',
        'p-5',
        designTokens.text.body,
        'shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)]',
        'transition-all',
        'duration-300',
        'hover:-translate-y-[2px]',
        'hover:border-slate-300',
        'dark:border-slate-700',
        ...designTokens.surfaces.layered.panel70,
        designTokens.text.body,
        'dark:hover:border-slate-600'
      )}
      data-testid="budget-summary-card"
    >
      <div
        className={cn(
          'pointer-events-none',
          'absolute',
          'inset-0',
          'rounded-2xl',
          'bg-gradient-to-br',
          'from-slate-200/40',
          'via-slate-100/20',
          'to-transparent',
          'opacity-0',
          'transition-opacity',
          'duration-300',
          'group-hover:opacity-100',
          'dark:from-slate-700/40',
          'dark:via-slate-800/20'
        )}
      />
      <div className={cn('relative', 'z-10', 'flex', 'items-center', 'justify-between', 'gap-4')}>
        <div>
          <div
            className={cn(
              designTokens.typography.label,
              designTokens.text.subtle,
              'transition-colors',
              'duration-500'
            )}
          >
            Total Planned
          </div>
          <div
            className={cn(
              'mt-1',
              'text-2xl',
              'font-semibold',
              designTokens.text.primary,
              'transition-colors',
              'duration-500'
            )}
          >
            {fmtUSD(totalBudgeted)}
          </div>
        </div>
        <div className="text-right">
          <div
            className={cn(
              designTokens.typography.label,
              designTokens.text.subtle,
              'transition-colors',
              'duration-500'
            )}
          >
            Total Spent
          </div>
          <div
            className={cn(
              'mt-1',
              'text-2xl',
              'font-semibold',
              'transition-colors',
              'duration-500',
              overBudget ? designTokens.text.danger : designTokens.text.body
            )}
          >
            {fmtUSD(totalSpent)}
          </div>
        </div>
      </div>
      <div className={cn('relative', 'z-10', 'mt-4')}>
        <BudgetProgress amount={totalBudgeted} spent={totalSpent} />
      </div>
    </div>
  );
};

export default BudgetSummaryCard;
