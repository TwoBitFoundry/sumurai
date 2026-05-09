import { cn } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  effect as uiEffectRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
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
        ...uiBorderRecipes.default,
        ...uiSurfaceRecipes.card,
        'p-5',
        uiTextRecipes.body,
        ...uiEffectRecipes.glassShadow,
        'transition-all',
        'duration-300',
        'hover:-translate-y-[2px]',
        uiTextRecipes.body,
        ...uiBorderRecipes.hoverAccent
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
          'from-[var(--color-surface-muted-chip)]/40',
          'via-[var(--color-surface-card)]/20',
          'to-transparent',
          'opacity-0',
          'transition-opacity',
          'duration-300',
          'group-hover:opacity-100',
          'dark:from-[var(--color-surface-muted-chip)]/40',
          'dark:via-[var(--color-surface-card)]/20'
        )}
      />
      <div className={cn('relative', 'z-10', 'flex', 'items-center', 'justify-between', 'gap-4')}>
        <div>
          <div
            className={cn(
              uiTypographyRecipes.label,
              uiTextRecipes.subtle,
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
              uiTextRecipes.primary,
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
              uiTypographyRecipes.label,
              uiTextRecipes.subtle,
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
              overBudget ? uiTextRecipes.danger : uiTextRecipes.body
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
