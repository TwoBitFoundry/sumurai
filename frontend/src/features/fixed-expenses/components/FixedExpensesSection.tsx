import { Repeat2 } from 'lucide-react';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import type { FixedExpenseSummary } from '@/types/api';
import { heroAccents } from '@/ui/tokens';
import { FixedExpenseList } from './FixedExpenseList';

export interface FixedExpensesSectionProps {
  fixedExpenses: FixedExpenseSummary[];
  isLoading?: boolean;
}

export function FixedExpensesSection({
  fixedExpenses,
  isLoading = false,
}: FixedExpensesSectionProps) {
  return (
    <CollapsibleSection
      sectionId="subscriptions"
      title="Fixed Expenses"
      titleIcon={Repeat2}
      titleIconClassName={heroAccents.sky.icon}
      testId="subscriptions-section"
      expandLabel="Show fixed expenses"
      collapseLabel="Hide fixed expenses"
    >
      <FixedExpenseList fixedExpenses={fixedExpenses} isLoading={isLoading} />
    </CollapsibleSection>
  );
}
