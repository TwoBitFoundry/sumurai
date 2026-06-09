import { Info } from 'lucide-react';
import { cn } from '@/ui/primitives';
import { controlIconWell, text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

export const insightQuestionRecipes = {
  row: 'flex items-center gap-2',
  icon: cn(...controlIconWell.sm, uiTextRecipes.subtle, '[&_svg]:stroke-[2]'),
  text: cn(uiTypographyRecipes.label, uiTextRecipes.subtle, 'min-w-0'),
} as const;

export function InsightQuestion({ question }: { question: string }) {
  return (
    <div className={cn(insightQuestionRecipes.row)} data-testid="insight-question">
      <span className={cn(insightQuestionRecipes.icon)} aria-hidden="true">
        <Info />
      </span>
      <p className={cn(insightQuestionRecipes.text)}>{question}</p>
    </div>
  );
}
