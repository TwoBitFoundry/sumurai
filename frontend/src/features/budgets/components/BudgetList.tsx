import { CheckIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { TrashIcon as TrashSolidIcon } from '@heroicons/react/24/solid';
import { Target } from 'lucide-react';
import React from 'react';
import { cn, EmptyState } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';
import { formatCategoryName, getTagThemeForCategory } from '../../../utils/categories';
import { fmtUSD } from '../../../utils/format';
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
              designTokens.components.budgetCard.shell,
              tagTheme.ring,
              'ring-1 ring-offset-1',
              designTokens.surfaces.ringOffsetLightOnDark
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
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-all duration-300 backdrop-blur-sm ring-1 ring-white/60 dark:ring-white/10 ${tagTheme.tag}`}
              >
                <span
                  className={`h-2 w-2 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.85)] dark:shadow-[0_0_0_1px_rgba(15,23,42,0.7)] ${tagTheme.dot}`}
                  aria-hidden="true"
                />
                {displayName}
              </div>
              <div className={cn('flex', 'items-center', 'gap-2', 'text-xs')}>
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onSaveEdit(b.id, Number(draft))}
                      title="Save"
                      aria-label="Save budget"
                      className={cn(designTokens.components.budgetSaveIconButton)}
                    >
                      <CheckIcon className={cn('h-4', 'w-4')} />
                    </button>
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      title="Cancel"
                      aria-label="Cancel edit"
                      className={cn(designTokens.components.budgetIconButtonGhost)}
                    >
                      <XMarkIcon className={cn('h-4', 'w-4')} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onStartEdit(b)}
                      title="Edit budget"
                      aria-label="Edit budget"
                      className={cn(designTokens.components.budgetIconButtonGhost)}
                    >
                      <PencilSquareIcon className={cn('h-4', 'w-4')} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(b.id)}
                      title="Delete budget"
                      aria-label="Delete budget"
                      className={cn(
                        'inline-flex',
                        'items-center',
                        'justify-center',
                        'rounded-full',
                        'bg-red-500/15',
                        'p-2',
                        'text-red-600',
                        'shadow-[0_16px_38px_-26px_rgba(248,113,113,0.55)]',
                        'transition-transform',
                        'duration-200',
                        'hover:-translate-y-[2px]',
                        'hover:bg-red-500/25',
                        'focus-visible:outline-none',
                        'focus-visible:ring-2',
                        'focus-visible:ring-red-400/70',
                        'focus-visible:ring-offset-2',
                        'focus-visible:ring-offset-white',
                        'dark:bg-red-500/20',
                        'dark:text-red-300',
                        'dark:hover:bg-red-500/25',
                        designTokens.surfaces.focusRingOffsetDarkVisible
                      )}
                    >
                      <TrashSolidIcon className={cn('h-4', 'w-4')} />
                    </button>
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
                        'text-[0.65rem]',
                        'font-semibold',
                        'uppercase',
                        'tracking-[0.24em]',
                        'text-slate-500',
                        'transition-colors',
                        'duration-300',
                        'dark:text-slate-400'
                      )}
                    >
                      Planned amount
                    </label>
                    <input
                      id={`budget-amount-${b.id}`}
                      data-testid="budget-amount-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={draft}
                      onChange={(e) => setAmountDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
                      className={cn(
                        'w-full',
                        'rounded-2xl',
                        'border',
                        'border-white/60',
                        'bg-white/90',
                        'px-4',
                        'py-2',
                        'text-base',
                        'font-semibold',
                        'text-slate-800',
                        'shadow-[0_20px_55px_-38px_rgba(15,23,42,0.55)]',
                        'transition-colors',
                        'duration-200',
                        'focus:outline-none',
                        'focus:ring-2',
                        'focus:ring-sky-400/80',
                        'focus:ring-offset-2',
                        'focus:ring-offset-white',
                        'dark:border-white/12',
                        designTokens.surfaces.inputDark85,
                        'dark:text-white',
                        designTokens.surfaces.focusRingOffsetDark
                      )}
                    />
                  </div>
                  <div
                    className={cn(
                      'text-right',
                      'text-sm',
                      'text-slate-500',
                      'transition-colors',
                      'duration-300',
                      'dark:text-slate-400'
                    )}
                  >
                    <span
                      className={cn(
                        'block',
                        'text-[0.65rem]',
                        'font-semibold',
                        'uppercase',
                        'tracking-[0.24em]',
                        'text-slate-500',
                        'transition-colors',
                        'duration-300',
                        'dark:text-slate-400'
                      )}
                    >
                      Spent
                    </span>
                    <span
                      className={cn(
                        'text-base',
                        'font-semibold',
                        'text-slate-700',
                        'transition-colors',
                        'duration-300',
                        'dark:text-slate-200'
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
                    'text-sm',
                    'text-slate-500',
                    'transition-colors',
                    'duration-300',
                    'dark:text-slate-400'
                  )}
                >
                  <div>
                    <span
                      className={cn(
                        'text-[0.65rem]',
                        'font-semibold',
                        'uppercase',
                        'tracking-[0.24em]',
                        'text-slate-500',
                        'transition-colors',
                        'duration-300',
                        'dark:text-slate-500'
                      )}
                    >
                      Planned
                    </span>
                    <div
                      className={cn(
                        'mt-1',
                        'text-2xl',
                        'font-semibold',
                        'text-slate-900',
                        'transition-colors',
                        'duration-300',
                        'dark:text-white'
                      )}
                    >
                      {fmtUSD(b.amount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        'text-[0.65rem]',
                        'font-semibold',
                        'uppercase',
                        'tracking-[0.24em]',
                        'text-slate-500',
                        'transition-colors',
                        'duration-300',
                        'dark:text-slate-500'
                      )}
                    >
                      Spent
                    </span>
                    <div
                      className={`mt-1 text-2xl font-semibold transition-colors duration-300 ${isOver ? 'text-red-600 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`}
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
