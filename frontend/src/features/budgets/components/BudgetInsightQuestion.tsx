import { Info } from 'lucide-react';
import { cn } from '@/ui/primitives';
import { controlIconWell, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

export const budgetInsightQuestionRecipes = {
  row: 'flex items-center gap-2',
  icon: cn(...controlIconWell.sm, uiTextRecipes.subtle, '[&_svg]:stroke-[2]'),
  text: cn(uiTypographyRecipes.label, uiTextRecipes.subtle, 'min-w-0'),
} as const;

export function BudgetInsightQuestion({ question }: { question: string }) {
  return (
    <div className={cn(budgetInsightQuestionRecipes.row)} data-testid="budget-insight-question">
      <span className={cn(budgetInsightQuestionRecipes.icon)} aria-hidden="true">
        <Info />
      </span>
      <p className={cn(budgetInsightQuestionRecipes.text)}>{question}</p>
    </div>
  );
}
