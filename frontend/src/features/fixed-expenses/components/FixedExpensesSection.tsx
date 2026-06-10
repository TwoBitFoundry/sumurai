import { Repeat2 } from 'lucide-react';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import type { FixedExpenseSummary } from '@/types/api';
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
      titleIconClassName={heroAccents.sky.icon}
      testId="fixed-expenses-section"
      expandLabel="Show fixed expenses"
      collapseLabel="Hide fixed expenses"
    >
      <FixedExpenseList fixedExpenses={fixedExpenses} month={month} isLoading={isLoading} />
    </CollapsibleSection>
  );
}
