import { CalendarClock, Check, Repeat2, Timer, X } from 'lucide-react';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SubscriptionCadenceIcon } from '@/components/SubscriptionCadenceIcon';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import {
  type FixedExpenseDueDateInMonth,
  type FixedExpenseDueDateStatus,
  type FixedExpenseMonthState,
  listFixedExpenseDueDatesInMonth,
  resolveFixedExpenseMonthState,
} from '@/domain/FixedExpenseCalculator';
import {
  FIXED_EXPENSE_CADENCE_LABELS,
  FIXED_EXPENSE_CADENCE_ORDER,
  type FixedExpenseCadenceKey,
  groupFixedExpensesByCadence,
} from '@/domain/fixedExpenseCadences';
import { getFixedExpenseCategoryPrimary } from '@/domain/fixedExpenseCategories';
import { useCategories } from '@/features/transactions/hooks/useCategories';
import type { FixedExpenseSummary } from '@/types/api';
import { cn, EmptyState, Pill } from '@/ui/primitives';
import {
  control,
  controlIconWell,
  status as uiStatusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { getHeroAccentForCategoryKey, getHeroAccentTheme } from '@/ui/tokens';
import { formatCategoryName, getTagThemeForCategory } from '@/utils/categories';
import { fmtUSD } from '@/utils/format';

export interface FixedExpenseListProps {
  fixedExpenses: FixedExpenseSummary[];
  month: Date;
  isLoading?: boolean;
}

const fixedExpenseDueDateStatusText = {
  paid: uiStatusRecipes.success.text,
  upcoming: uiStatusRecipes.warning.text,
  missed: uiStatusRecipes.danger.text,
} as const satisfies Record<FixedExpenseDueDateStatus, readonly string[]>;

const fixedExpenseDueDateStatusLabel = {
  paid: 'Paid',
  upcoming: 'Upcoming',
  missed: 'Missed',
} as const satisfies Record<FixedExpenseDueDateStatus, string>;

const fixedExpenseHoverHintShell = cn(
  'pointer-events-none',
  'fixed',
  'z-[100]',
  'whitespace-nowrap',
  'rounded-[length:var(--radius-standard)]',
  'border',
  'border-[var(--color-border-subtle)]',
  'dark:border-[color:color-mix(in_srgb,var(--color-border-glass)_12%,transparent)]',
  'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_90%,transparent)]',
  'dark:bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_95%,transparent)]',
  'px-2',
  'py-1',
  uiTypographyRecipes.caption,
  uiTextRecipes.body,
  'font-medium',
  'shadow-sm',
  'backdrop-blur-sm'
);

function FixedExpenseHoverHint({
  label,
  ariaLabel,
  placement,
  children,
  className,
}: {
  label: string;
  ariaLabel?: string;
  placement: 'above' | 'below';
  children: ReactNode;
  className?: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showHint = () => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    setCoords({
      left: rect.left + rect.width / 2,
      top: placement === 'above' ? rect.top : rect.bottom,
    });
  };

  const hideHint = () => {
    setCoords(null);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel ?? label}
        className={cn(
          'inline-flex',
          'border-0',
          'bg-transparent',
          'p-0',
          'font-inherit',
          'leading-inherit',
          className
        )}
        onMouseEnter={showHint}
        onMouseLeave={hideHint}
        onFocus={showHint}
        onBlur={hideHint}
      >
        {children}
      </button>
      {mounted &&
        coords &&
        createPortal(
          <span
            role="tooltip"
            style={{
              left: coords.left,
              top: coords.top,
              transform:
                placement === 'above'
                  ? 'translate(-50%, calc(-100% - 0.3rem))'
                  : 'translate(-50%, 0.3rem)',
            }}
            className={fixedExpenseHoverHintShell}
          >
            {label}
          </span>,
          document.body
        )}
    </>
  );
}

function FixedExpenseDueDates({
  dueDates,
  month,
}: {
  dueDates: FixedExpenseDueDateInMonth[];
  month: Date;
}) {
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(month);

  return (
    <span className={cn('min-w-0', 'truncate')}>
      <span>{monthLabel} </span>
      {dueDates.map((entry, index) => (
        <span key={entry.isoDate}>
          {index > 0 ? ', ' : null}
          <FixedExpenseHoverHint
            label={fixedExpenseDueDateStatusLabel[entry.status]}
            ariaLabel={`${monthLabel} ${entry.day}: ${fixedExpenseDueDateStatusLabel[entry.status]}`}
            placement="above"
          >
            <span
              data-testid={`fixed-expense-due-day-${entry.status}`}
              className={cn(...fixedExpenseDueDateStatusText[entry.status], 'font-medium')}
            >
              {entry.day}
            </span>
          </FixedExpenseHoverHint>
        </span>
      ))}
    </span>
  );
}

const fixedExpenseMonthStateConfig = {
  paid: {
    label: 'All payments paid',
    iconClass: uiStatusRecipes.success.icon,
    Icon: Check,
  },
  due: {
    label: 'Upcoming payment',
    iconClass: uiStatusRecipes.warning.icon,
    Icon: Timer,
  },
  missed: {
    label: 'Missing payment',
    iconClass: uiStatusRecipes.danger.icon,
    Icon: X,
  },
} as const satisfies Record<
  FixedExpenseMonthState,
  { label: string; iconClass: readonly string[]; Icon: typeof Check }
>;

function FixedExpenseMonthStateIcon({ state }: { state: FixedExpenseMonthState }) {
  const { label, iconClass, Icon } = fixedExpenseMonthStateConfig[state];

  return (
    <FixedExpenseHoverHint label={label} placement="below">
      <span
        data-testid={`fixed-expense-state-${state}`}
        className={cn('inline-flex', 'shrink-0', 'items-center')}
      >
        <span className={cn(...controlIconWell.sm, iconClass)}>
          <Icon strokeWidth={2.25} aria-hidden />
        </span>
      </span>
    </FixedExpenseHoverHint>
  );
}

const sectionBadgeClass = cn(uiTypographyRecipes.label, uiTextRecipes.muted);

function FixedExpenseCadenceGroupHeader({ cadence }: { cadence: FixedExpenseCadenceKey }) {
  return (
    <span className={cn(sectionBadgeClass, 'inline-flex items-center gap-2')}>
      <span className={cn(...controlIconWell.lg)}>
        <SubscriptionCadenceIcon
          cadence={cadence === 'weekly' || cadence === 'biweekly' ? 'monthly' : cadence}
        />
      </span>
      {FIXED_EXPENSE_CADENCE_LABELS[cadence]}
    </span>
  );
}

function CategoryBadge({
  categoryPrimary,
  accentIndexByName,
}: {
  categoryPrimary: ReturnType<typeof getFixedExpenseCategoryPrimary>;
  accentIndexByName: ReadonlyMap<string, number>;
}) {
  return (
    <Pill variant="category" categoryName={categoryPrimary} accentIndexByName={accentIndexByName}>
      {formatCategoryName(categoryPrimary)}
    </Pill>
  );
}

function FixedExpenseCard({
  item,
  month,
  accentIndexByName,
}: {
  item: FixedExpenseSummary;
  month: Date;
  accentIndexByName: ReadonlyMap<string, number>;
}) {
  const categoryPrimary = getFixedExpenseCategoryPrimary(item.category);
  const tagTheme = getTagThemeForCategory(categoryPrimary, accentIndexByName);
  const heroStyles = getHeroAccentTheme(getHeroAccentForCategoryKey(tagTheme.key));
  const referenceToday = new Date();
  const dueDates = listFixedExpenseDueDatesInMonth(item, month, referenceToday);
  const monthState = resolveFixedExpenseMonthState(item, month, referenceToday, dueDates);
  const hoverInsetRingStyle = {
    boxShadow: `inset 0 0 0 2px ${tagTheme.ringHex}`,
  } as CSSProperties;

  return (
    <li className={cn(heroStatCardRecipes.base, 'min-w-0', 'w-full')}>
      <div
        data-testid={`fixed-expense-card-${item.normalized_merchant}`}
        className={cn(
          heroStatCardRecipes.shell,
          '!border-0',
          'flex w-full flex-col gap-1.5 !px-3.5 !py-2 text-left md:!px-4'
        )}
      >
        <div
          className={cn(
            'hero-stat-card__gradient',
            'pointer-events-none',
            'absolute',
            'inset-0',
            'rounded-[length:inherit]',
            'opacity-100'
          )}
          style={{
            backgroundImage: `linear-gradient(135deg, ${heroStyles.gradFrom}33, ${heroStyles.gradVia}1f, transparent 70%)`,
          }}
        />
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
        <div className={cn('relative', 'z-10', 'flex', 'flex-col', 'gap-1.5')}>
          <div className={cn('flex', 'items-start', 'justify-between', 'gap-2')}>
            <CategoryBadge
              categoryPrimary={categoryPrimary}
              accentIndexByName={accentIndexByName}
            />
            <FixedExpenseMonthStateIcon state={monthState} />
          </div>
          <div className={cn('flex', 'min-w-0', 'items-baseline', 'justify-between', 'gap-2')}>
            <span
              className={cn(
                uiTypographyRecipes.cardTitle,
                uiTextRecipes.primary,
                'min-w-0',
                'truncate'
              )}
            >
              {item.merchant}
            </span>
            <div
              className={cn('flex', 'shrink-0', 'items-baseline', 'gap-1.5', 'whitespace-nowrap')}
            >
              <span className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}>
                {fmtUSD(item.monthly_cost)}
              </span>
              <span className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>/ mo</span>
            </div>
          </div>
          <div
            className={cn(
              'flex',
              'min-w-0',
              'items-center',
              'gap-2',
              uiTypographyRecipes.caption,
              uiTextRecipes.muted
            )}
          >
            <div
              className={cn(
                'flex',
                'min-w-0',
                'flex-1',
                'items-center',
                'justify-start',
                'gap-1',
                'overflow-hidden'
              )}
            >
              <CalendarClock className={cn(control.glyph.sm, 'shrink-0')} aria-hidden />
              <FixedExpenseDueDates dueDates={dueDates} month={month} />
            </div>
            <span className={cn('shrink-0', 'tabular-nums', 'whitespace-nowrap')}>
              {item.occurrence_count}
              <span className={cn(uiTypographyRecipes.caption, uiTextRecipes.body, 'ml-0.5')}>
                tx
              </span>
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

export function FixedExpenseList({
  fixedExpenses,
  month,
  isLoading = false,
}: FixedExpenseListProps) {
  const { accentIndexByName } = useCategories();
  const grouped = groupFixedExpensesByCadence(fixedExpenses, month);

  if (!isLoading && fixedExpenses.length === 0) {
    return (
      <EmptyState
        icon={Repeat2}
        title="No fixed expenses detected"
        description="Fixed expenses are detected automatically after a sync or categorization run."
        data-testid="fixed-expenses-empty-state"
      />
    );
  }

  return (
    <div className={cn('space-y-6')} data-testid="fixed-expense-cadence-groups">
      {FIXED_EXPENSE_CADENCE_ORDER.map((cadence) => {
        const items = grouped[cadence];
        if (items.length === 0) {
          return null;
        }

        return (
          <section
            key={cadence}
            className={cn('space-y-3')}
            data-testid={`fixed-expense-cadence-group-${cadence}`}
          >
            <FixedExpenseCadenceGroupHeader cadence={cadence} />
            <ul className={cn('grid', 'grid-cols-1', 'gap-3', 'md:grid-cols-2', 'lg:grid-cols-3')}>
              {items.map((item) => (
                <FixedExpenseCard
                  key={item.normalized_merchant}
                  item={item}
                  month={month}
                  accentIndexByName={accentIndexByName}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
