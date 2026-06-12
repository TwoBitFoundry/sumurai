import { TrashIcon as TrashSolidIcon } from '@heroicons/react/24/solid';
import { Target } from 'lucide-react';
import type { CSSProperties } from 'react';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import { cn, EmptyState, IconButton, Input, Pill } from '@/ui/primitives';
import {
  effect as uiEffectRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';
import { formatCategoryName } from '../../../utils/categories';
import { fmtUSD } from '../../../utils/format';
import { useCategories } from '../../transactions/hooks/useCategories';
import type { BudgetProgressEntry } from '../hooks/useBudgets';
import BudgetProgress from './BudgetProgress';

export type BudgetWithProgress = BudgetProgressEntry;

const budgetStatGridClass = cn(
  'grid',
  'grid-cols-[auto_1fr_auto]',
  'grid-rows-[auto_auto]',
  'items-baseline',
  'gap-x-2',
  'gap-y-2',
  'md:gap-x-3',
  'md:gap-y-2.5'
);

const budgetAmountClass = cn(
  uiTypographyRecipes.cardTitle,
  'tabular-nums',
  'transition-colors',
  'duration-300'
);

const budgetBarSlotClass = cn(
  'flex',
  'min-w-0',
  'w-full',
  'min-h-8',
  'items-center',
  'self-center'
);

const budgetHeroHoverRingStyle = {
  boxShadow: `inset 0 0 0 2px ${heroAccents.sky.ringHex}`,
} as CSSProperties;

export function BudgetList({
  items,
  isEditing,
  drafts,
  onDraftChange,
  onDelete,
}: {
  items: BudgetWithProgress[];
  isEditing: boolean;
  drafts: Record<string, string>;
  onDraftChange: (id: string, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const { accentIndexByName } = useCategories();

  if (items.length === 0) {
    return (
      <div className={cn('px-6', 'py-12')}>
        <EmptyState
          icon={Target}
          title="No budgets yet"
          description="Set your first category limit. Lead the month with discipline."
        />
      </div>
    );
  }

  return (
    <ul className={cn('grid', 'grid-cols-1', 'gap-6', 'md:grid-cols-2', 'lg:grid-cols-3')}>
      {items.map((b) => {
        const isOver = b.spent > b.amount;
        const displayName = formatCategoryName(b.category);
        const hoverInsetRingStyle = budgetHeroHoverRingStyle;
        const draft = drafts[b.id] ?? String(b.amount);
        const parsedDraft = Number(draft);
        const editPlannedAmount =
          Number.isFinite(parsedDraft) && draft !== '' ? parsedDraft : b.amount;
        return (
          <li key={b.id} className={cn(heroStatCardRecipes.base, 'h-full')}>
            <div
              className={cn(
                heroStatCardRecipes.shell,
                '!border-0',
                'flex h-full flex-col p-3.5 pt-4 md:p-3.5 md:pt-4 lg:p-4 lg:pt-5'
              )}
            >
              <div
                aria-hidden
                className={cn(
                  'hero-stat-card__inset-ring',
                  'pointer-events-none',
                  'absolute',
                  'inset-0',
                  'z-[1]',
                  'rounded-[length:inherit]',
                  'opacity-0',
                  'transition-opacity',
                  'duration-200',
                  'group-hover:opacity-100'
                )}
                style={hoverInsetRingStyle}
              />
              <div className={cn('relative z-10 flex items-start justify-between gap-3')}>
                <Pill
                  variant="category"
                  categoryName={b.category}
                  accentIndexByName={accentIndexByName}
                  className={cn(
                    'transition-all duration-300',
                    ...uiEffectRecipes.glassBackdrop,
                    'dark:ring-1 dark:ring-white/10'
                  )}
                >
                  {displayName}
                </Pill>
                {isEditing ? (
                  <div
                    className={cn(
                      'flex items-center justify-end gap-1.5',
                      uiTypographyRecipes.label
                    )}
                  >
                    <IconButton
                      variant="danger"
                      size="sm"
                      onClick={() => onDelete(b.id)}
                      title="Delete budget"
                      aria-label="Delete budget"
                    >
                      <TrashSolidIcon />
                    </IconButton>
                  </div>
                ) : null}
              </div>
              <div className={cn('relative', 'z-10', 'mt-3', 'flex-1', 'lg:mt-2')}>
                <div className={budgetStatGridClass}>
                  <div className={cn(uiTypographyRecipes.label, uiTextRecipes.subtle)}>Spent</div>
                  <div aria-hidden />
                  <div
                    className={cn(uiTypographyRecipes.label, uiTextRecipes.subtle, 'text-right')}
                  >
                    Planned
                  </div>

                  <div
                    className={cn(
                      budgetAmountClass,
                      'self-center',
                      isOver ? uiTextRecipes.danger : uiTextRecipes.body
                    )}
                  >
                    {fmtUSD(b.spent)}
                  </div>
                  <div className={budgetBarSlotClass}>
                    {isEditing ? (
                      <>
                        <label htmlFor={`budget-amount-${b.id}`} className="sr-only">
                          Planned amount
                        </label>
                        <Input
                          id={`budget-amount-${b.id}`}
                          data-testid="budget-amount-input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={draft}
                          placeholder="Planned amount"
                          onChange={(e) => onDraftChange(b.id, e.target.value)}
                          variant="glass"
                          inputSize="sm"
                          className={cn(
                            'w-full',
                            'h-8',
                            'min-h-8',
                            'px-2',
                            'py-0',
                            'text-center',
                            budgetAmountClass,
                            uiTextRecipes.primary,
                            'placeholder:font-normal',
                            'placeholder:text-slate-500',
                            'dark:placeholder:text-slate-400',
                            'shadow-none'
                          )}
                        />
                      </>
                    ) : (
                      <BudgetProgress amount={b.amount} spent={b.spent} showCaptions={false} />
                    )}
                  </div>
                  <div
                    className={cn(
                      budgetAmountClass,
                      uiTextRecipes.primary,
                      'self-center',
                      'text-right'
                    )}
                  >
                    {fmtUSD(isEditing ? editPlannedAmount : b.amount)}
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default BudgetList;
