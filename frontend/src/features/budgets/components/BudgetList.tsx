import { CheckIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { TrashIcon as TrashSolidIcon } from '@heroicons/react/24/solid';
import { Target } from 'lucide-react';
import type { CSSProperties } from 'react';
import React from 'react';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import { cn, EmptyState, IconButton, Input, Pill } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';
import { getHeroAccentForCategoryKey, getHeroAccentTheme } from '@/ui/tokens';
import { formatCategoryName, getTagThemeForCategory } from '../../../utils/categories';
import { fmtUSD } from '../../../utils/format';
import { useCategories } from '../../transactions/hooks/useCategories';
import type { BudgetProgressEntry } from '../hooks/useBudgets';
import BudgetProgress from './BudgetProgress';

export type BudgetWithProgress = BudgetProgressEntry;

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
        const ringColorStyle = {
          '--tw-ring-color': `${heroStyles.ringHex}66`,
        } as CSSProperties;
        const isEditing = editingId === b.id;
        const draft = amountDrafts[b.id] ?? String(b.amount);
        return (
          <li key={b.id} className={cn(heroStatCardRecipes.base, 'h-full')}>
            <div
              className={cn(
                heroStatCardRecipes.shell,
                heroStyles.border,
                heroStyles.borderDark,
                heroStyles.hoverBorder,
                heroStyles.hoverBorderDark,
                'flex h-full flex-col p-3.5 pt-4 md:p-3.5 md:pt-4 lg:p-4 lg:pt-5'
              )}
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
                <div className={cn(heroStatCardRecipes.ringLine)} style={ringColorStyle} />
              </div>
              <div className={cn('relative z-10 flex items-start justify-between gap-3')}>
                <Pill
                  variant="category"
                  categoryName={displayName}
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
              <div
                className={cn(
                  'relative z-10 mt-3 flex-1 space-y-3 md:space-y-3.5 lg:mt-2 lg:space-y-4'
                )}
              >
                {isEditing ? (
                  <div
                    className={cn(
                      'grid',
                      'grid-cols-1',
                      'gap-3',
                      'md:grid-cols-[1fr_auto]',
                      'md:items-end'
                    )}
                  >
                    <div className="space-y-2">
                      <label
                        htmlFor={`budget-amount-${b.id}`}
                        className={cn(
                          'block',
                          uiTypographyRecipes.label,
                          uiTextRecipes.subtle,
                          'transition-colors',
                          'duration-300'
                        )}
                      >
                        Planned amount
                      </label>
                      <Input
                        id={`budget-amount-${b.id}`}
                        data-testid="budget-amount-input"
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft}
                        onChange={(e) => setAmountDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                        variant="glass"
                        inputSize="lg"
                      />
                    </div>
                    <div
                      className={cn(
                        'text-right',
                        uiTypographyRecipes.caption,
                        uiTextRecipes.subtle,
                        'transition-colors',
                        'duration-300'
                      )}
                    >
                      <span
                        className={cn(
                          'block',
                          uiTypographyRecipes.label,
                          uiTextRecipes.subtle,
                          'transition-colors',
                          'duration-300'
                        )}
                      >
                        Spent
                      </span>
                      <span
                        className={cn(
                          uiTypographyRecipes.bodyStrong,
                          uiTextRecipes.body,
                          'transition-colors',
                          'duration-300'
                        )}
                      >
                        {fmtUSD(b.spent)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'grid',
                      'grid-cols-2',
                      'gap-3',
                      uiTypographyRecipes.caption,
                      uiTextRecipes.subtle,
                      'transition-colors',
                      'duration-300'
                    )}
                  >
                    <div>
                      <span
                        className={cn(
                          uiTypographyRecipes.label,
                          uiTextRecipes.subtle,
                          'transition-colors',
                          'duration-300'
                        )}
                      >
                        Spent
                      </span>
                      <div
                        className={cn(
                          'mt-1',
                          uiTypographyRecipes.cardTitle,
                          'transition-colors',
                          'duration-300',
                          isOver ? uiTextRecipes.danger : uiTextRecipes.body
                        )}
                      >
                        {fmtUSD(b.spent)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={cn(
                          uiTypographyRecipes.label,
                          uiTextRecipes.subtle,
                          'transition-colors',
                          'duration-300'
                        )}
                      >
                        Planned
                      </span>
                      <div
                        className={cn(
                          'mt-1',
                          uiTypographyRecipes.cardTitle,
                          uiTextRecipes.primary,
                          'transition-colors',
                          'duration-300'
                        )}
                      >
                        {fmtUSD(b.amount)}
                      </div>
                    </div>
                  </div>
                )}
                <BudgetProgress amount={b.amount} spent={b.spent} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default BudgetList;
