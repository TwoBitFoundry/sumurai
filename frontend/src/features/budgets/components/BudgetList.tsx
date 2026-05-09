import { CheckIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { TrashIcon as TrashSolidIcon } from '@heroicons/react/24/solid';
import { Target } from 'lucide-react';
import React from 'react';
import { cn, EmptyState, IconButton, Input } from '@/ui/primitives';
import { primitiveTokenRecipes } from '@/ui/primitives/recipes';
import {
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
} from '@/ui/recipes';
import { designTokens } from '@/ui/tokens';
import { formatCategoryName, getTagThemeForCategory } from '../../../utils/categories';
import { fmtUSD } from '../../../utils/format';
import type { BudgetProgressEntry } from '../hooks/useBudgets';
import BudgetProgress from './BudgetProgress';

export type BudgetWithProgress = BudgetProgressEntry;

const budgetCardShell = [
  'group relative overflow-hidden rounded-[1.75rem] p-6',
  ...semanticBorders.subtle,
  ...semanticSurfaces.card,
  ...semanticEffects.glassShadow,
  'transition-all duration-300 hover:-translate-y-1',
  ...semanticEffects.accentHover,
] as const;

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
  const [amountDrafts, setAmountDrafts] = React.useState<Record<string, string>>({});

  if (items.length === 0) {
    return (
      <div className={cn('px-6', 'py-12')}>
        <EmptyState
          icon={Target}
          title="No budgets found"
          description="Create your first budget to start tracking spending targets for each category."
        />
      </div>
    );
  }

  return (
    <ul
      className={cn(
        'grid',
        'grid-cols-1',
        'gap-6',
        'p-6',
        'sm:px-10',
        'md:grid-cols-2',
        'xl:grid-cols-3',
        '2xl:grid-cols-4'
      )}
    >
      {items.map((b) => {
        const isOver = b.spent > b.amount;
        const displayName = formatCategoryName(b.category);
        const tagTheme = getTagThemeForCategory(displayName);
        const isEditing = editingId === b.id;
        const draft = amountDrafts[b.id] ?? String(b.amount);
        return (
          <li
            key={b.id}
            className={cn(
              budgetCardShell,
              tagTheme.ring,
              'ring-1 ring-offset-1',
              designTokens.surfaces.focus.ringOffsetLightOnDark
            )}
          >
            <div
              className={cn(
                'absolute',
                'inset-x-6',
                'top-0',
                'h-px',
                'bg-gradient-to-r',
                'from-transparent',
                'via-white/60',
                'to-transparent',
                'opacity-0',
                'transition-opacity',
                'duration-300',
                'group-hover:opacity-100',
                'dark:via-white/20'
              )}
            />
            <div className={cn('flex', 'items-start', 'justify-between', 'gap-3')}>
              <div
                className={cn(
                  primitiveTokenRecipes.pill.base,
                  'transition-all duration-300 backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10',
                  tagTheme.tag
                )}
              >
                <span
                  className={cn(primitiveTokenRecipes.pill.dot, tagTheme.dot)}
                  aria-hidden="true"
                />
                {displayName}
              </div>
              <div className={cn('flex', 'items-center', 'gap-2', designTokens.typography.label)}>
                {isEditing ? (
                  <>
                    <IconButton
                      variant="success"
                      onClick={() => onSaveEdit(b.id, Number(draft))}
                      title="Save"
                      aria-label="Save budget"
                    >
                      <CheckIcon className={cn('h-4', 'w-4')} />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      onClick={onCancelEdit}
                      title="Cancel"
                      aria-label="Cancel edit"
                    >
                      <XMarkIcon className={cn('h-4', 'w-4')} />
                    </IconButton>
                  </>
                ) : (
                  <>
                    <IconButton
                      variant="ghost"
                      onClick={() => onStartEdit(b)}
                      title="Edit budget"
                      aria-label="Edit budget"
                    >
                      <PencilSquareIcon className={cn('h-4', 'w-4')} />
                    </IconButton>
                    <IconButton
                      variant="danger"
                      onClick={() => onDelete(b.id)}
                      title="Delete budget"
                      aria-label="Delete budget"
                    >
                      <TrashSolidIcon className={cn('h-4', 'w-4')} />
                    </IconButton>
                  </>
                )}
              </div>
            </div>
            <div className={cn('mt-6', 'space-y-5')}>
              {isEditing ? (
                <div
                  className={cn(
                    'grid',
                    'grid-cols-1',
                    'gap-4',
                    'sm:grid-cols-[1fr_auto]',
                    'sm:items-end'
                  )}
                >
                  <div className="space-y-2">
                    <label
                      htmlFor={`budget-amount-${b.id}`}
                      className={cn(
                        'block',
                        designTokens.typography.label,
                        designTokens.text.subtle,
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
                      designTokens.typography.caption,
                      designTokens.text.subtle,
                      'transition-colors',
                      'duration-300'
                    )}
                  >
                    <span
                      className={cn(
                        'block',
                        designTokens.typography.label,
                        designTokens.text.subtle,
                        'transition-colors',
                        'duration-300'
                      )}
                    >
                      Spent
                    </span>
                    <span
                      className={cn(
                        designTokens.typography.bodyStrong,
                        designTokens.text.body,
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
                    'gap-4',
                    designTokens.typography.caption,
                    designTokens.text.subtle,
                    'transition-colors',
                    'duration-300'
                  )}
                >
                  <div>
                    <span
                      className={cn(
                        designTokens.typography.label,
                        designTokens.text.subtle,
                        'transition-colors',
                        'duration-300'
                      )}
                    >
                      Planned
                    </span>
                    <div
                      className={cn(
                        'mt-1',
                        designTokens.typography.cardTitle,
                        designTokens.text.primary,
                        'transition-colors',
                        'duration-300'
                      )}
                    >
                      {fmtUSD(b.amount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        designTokens.typography.label,
                        designTokens.text.subtle,
                        'transition-colors',
                        'duration-300'
                      )}
                    >
                      Spent
                    </span>
                    <div
                      className={cn(
                        'mt-1',
                        designTokens.typography.cardTitle,
                        'transition-colors',
                        'duration-300',
                        isOver ? designTokens.text.danger : designTokens.text.body
                      )}
                    >
                      {fmtUSD(b.spent)}
                    </div>
                  </div>
                </div>
              )}
              <BudgetProgress amount={b.amount} spent={b.spent} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default BudgetList;
