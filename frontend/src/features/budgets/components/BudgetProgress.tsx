import { cn } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';
import { fmtUSD } from '../../../utils/format';

const bp = designTokens.components.budgetProgress;

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
