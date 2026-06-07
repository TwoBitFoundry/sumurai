import { CheckIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { TrashIcon as TrashSolidIcon } from '@heroicons/react/24/solid';
import { Target } from 'lucide-react';
import type { CSSProperties } from 'react';
import React from 'react';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import { cn, EmptyState, IconButton, Input, Pill } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import {
  budgetProgress as budgetProgressRecipes,
  status,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { getHeroAccentForCategoryKey, getHeroAccentTheme } from '@/ui/tokens';
import { formatCategoryName, getTagThemeForCategory } from '../../../utils/categories';
import { fmtUSD } from '../../../utils/format';
import { useCategories } from '../../transactions/hooks/useCategories';
import type { BudgetProgressEntry } from '../hooks/useBudgets';
import BudgetProgress, { getBudgetProgressMetrics } from './BudgetProgress';

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

export function BudgetList({
  items,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  items: BudgetWithProgress[];
  editingId: string | null;
  onStartEdit: (b: BudgetWithProgress) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, amount: number) => void;
  onDelete: (id: string) => void;
}) {
  const { accentIndexByName } = useCategories();
  const [amountDrafts, setAmountDrafts] = React.useState<Record<string, string>>({});

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
        const tagTheme = getTagThemeForCategory(b.category, accentIndexByName);
        const heroStyles = getHeroAccentTheme(getHeroAccentForCategoryKey(tagTheme.key));
        const cardAccentStyle = {
          borderColor: `${tagTheme.ringHex}99`,
          '--tw-ring-color': `${tagTheme.ringHex}66`,
        } as CSSProperties;
        const isEditing = editingId === b.id;
        const draft = amountDrafts[b.id] ?? String(b.amount);
        const parsedDraft = Number(draft);
        const editPlannedAmount =
          Number.isFinite(parsedDraft) && draft !== '' ? parsedDraft : b.amount;
        const {
          clampedPercent,
          isOver: isOverBudget,
          remaining,
        } = getBudgetProgressMetrics(b.amount, b.spent);
        return (
          <li key={b.id} className={cn(heroStatCardRecipes.base, 'h-full')}>
            <div
              className={cn(
                heroStatCardRecipes.shell,
                'border-2',
                heroStyles.hoverBorder,
                heroStyles.hoverBorderDark,
                'flex h-full flex-col p-3.5 pt-4 md:p-3.5 md:pt-4 lg:p-4 lg:pt-5'
              )}
              style={cardAccentStyle}
            >
              <div
                className={cn(
                  'hero-stat-card__gradient',
                  'pointer-events-none',
                  'absolute',
                  'inset-0',
                  'rounded-[length:inherit]',
                  'opacity-0',
                  'transition-opacity',
                  'duration-300',
                  'group-hover:opacity-100'
                )}
                style={{
                  backgroundImage: `linear-gradient(135deg, ${heroStyles.gradFrom}33, ${heroStyles.gradVia}1f, transparent 70%)`,
                }}
              />
              <div className={cn(heroStatCardRecipes.ring)}>
                <div className={cn(heroStatCardRecipes.ringLine)} style={cardAccentStyle} />
              </div>
              <div className={cn('relative z-10 flex items-start justify-between gap-3')}>
                <Pill
                  variant="category"
                  categoryName={b.category}
                  accentIndexByName={accentIndexByName}
                  className={cn(
                    'transition-all duration-300 backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10'
                  )}
                >
                  {displayName}
                </Pill>
                <div
                  className={cn('flex items-center justify-end gap-1.5', uiTypographyRecipes.label)}
                >
                  {isEditing ? (
                    <>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        className={cn(appTitleBarRecipes.settingsIdle)}
                        onClick={onCancelEdit}
                        title="Cancel"
                        aria-label="Cancel edit"
                      >
                        <XMarkIcon />
                      </IconButton>
                      <IconButton
                        variant="success"
                        size="sm"
                        onClick={() => onSaveEdit(b.id, Number(draft))}
                        title="Save"
                        aria-label="Save budget"
                      >
                        <CheckIcon />
                      </IconButton>
                    </>
                  ) : (
                    <>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        className={cn(appTitleBarRecipes.settingsIdle)}
                        onClick={() => onStartEdit(b)}
                        title="Edit budget"
                        aria-label="Edit budget"
                      >
                        <PencilSquareIcon />
                      </IconButton>
                      <IconButton
                        variant="danger"
                        size="sm"
                        onClick={() => onDelete(b.id)}
                        title="Delete budget"
                        aria-label="Delete budget"
                      >
                        <TrashSolidIcon />
                      </IconButton>
                    </>
                  )}
                </div>
              </div>
              <div className={cn('relative', 'z-10', 'mt-3', 'flex-1', 'lg:mt-2')}>
                <div className={budgetStatGridClass}>
                  <div className={cn(uiTypographyRecipes.label, uiTextRecipes.subtle)}>Spent</div>
                  <div
                    className={cn(
                      'flex',
                      'min-w-0',
                      'items-baseline',
                      'justify-between',
                      'text-[0.75rem]',
                      uiTextRecipes.muted,
                      isEditing && 'invisible'
                    )}
                    aria-hidden={isEditing}
                  >
                    <span className={cn(...budgetProgressRecipes.captionPercent)}>
                      {clampedPercent.toFixed(0)}%
                    </span>
                    <span
                      className={cn(
                        ...budgetProgressRecipes.captionPercent,
                        ...(isOverBudget ? status.danger.text : uiTextRecipes.body)
                      )}
                    >
                      {isOverBudget ? fmtUSD(b.spent - b.amount) : fmtUSD(remaining)}
                    </span>
                  </div>
                  <div
                    className={cn(uiTypographyRecipes.label, uiTextRecipes.subtle, 'text-right')}
                  >
                    Planned
                  </div>

                  <div
                    className={cn(
                      budgetAmountClass,
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
                          onChange={(e) =>
                            setAmountDrafts((d) => ({ ...d, [b.id]: e.target.value }))
                          }
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
                  <div className={cn(budgetAmountClass, uiTextRecipes.primary, 'text-right')}>
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
