import { Loader2, Repeat2 } from 'lucide-react';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import type { FixedExpenseSummary } from '@/types/api';
import { cn } from '@/ui/primitives';
import { heroAccents } from '@/ui/tokens';
import { FixedExpenseList } from './FixedExpenseList';

export interface FixedExpensesSectionProps {
  fixedExpenses: FixedExpenseSummary[];
  month: Date;
  isLoading?: boolean;
}

export function FixedExpensesSection({
  fixedExpenses,
  month,
  isLoading = false,
}: FixedExpensesSectionProps) {
  return (
    <CollapsibleSection
      sectionId="fixed-expenses"
      title="Fixed Expenses"
      titleIcon={Repeat2}
      titleIconClassName={heroAccents.azure.icon}
      testId="fixed-expenses-section"
      expandLabel="Show fixed expenses"
      collapseLabel="Hide fixed expenses"
      actions={
        isLoading ? (
          <Loader2 className={cn('h-3.5', 'w-3.5', 'animate-spin')} aria-hidden="true" />
        ) : undefined
      }
    >
      <FixedExpenseList fixedExpenses={fixedExpenses} month={month} isLoading={isLoading} />
    </CollapsibleSection>
  );
}
