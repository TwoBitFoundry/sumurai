import { cn } from '@/ui/primitives';
import { budgetProgress as budgetProgressRecipes, status, text } from '@/ui/recipes';
import { fmtUSD } from '../../../utils/format';

export function BudgetProgress({ amount, spent }: { amount: number; spent: number }) {
  const percent = amount > 0 ? (spent / amount) * 100 : spent > 0 ? 100 : 0;
  const isOver = spent > amount;
  const remaining = Math.max(0, amount - spent);
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const fillWidthPercent = clampedPercent > 0 && clampedPercent < 4 ? 4 : clampedPercent;

  return (
    <div className={cn('space-y-2.5')}>
      <div
        className={cn(...budgetProgressRecipes.track)}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clampedPercent)}
        aria-label="Budget usage"
      >
        <div
          className={cn(
            ...budgetProgressRecipes.fillBase,
            ...(isOver ? budgetProgressRecipes.fillOver : budgetProgressRecipes.fillWithin)
          )}
          style={{ width: `${fillWidthPercent}%` }}
        />
      </div>
      <div className={cn(...budgetProgressRecipes.captionRow, text.muted)}>
        <span className={cn(...budgetProgressRecipes.captionPercent)}>
          {clampedPercent.toFixed(0)}% used
        </span>
        <span
          className={cn(
            ...budgetProgressRecipes.captionPercent,
            ...(isOver ? status.danger.text : text.body)
          )}
        >
          {isOver ? `-${fmtUSD(spent - amount)} over` : `${fmtUSD(remaining)} left`}
        </span>
      </div>
    </div>
  );
}

export default BudgetProgress;
