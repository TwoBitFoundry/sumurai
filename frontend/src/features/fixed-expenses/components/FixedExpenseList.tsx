import { ArrowRight, CalendarClock, Repeat2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { SubscriptionCadenceIcon } from '@/components/SubscriptionCadenceIcon';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import {
  FIXED_EXPENSE_CADENCE_LABELS,
  FIXED_EXPENSE_CADENCE_ORDER,
  type FixedExpenseCadenceKey,
  groupFixedExpensesByCadence,
} from '@/domain/fixedExpenseCadences';
import {
  formatSubscriptionDateRangeLabel,
  getSubscriptionDateRangeDisplay,
} from '@/domain/subscriptionDates';
import type { FixedExpenseSummary } from '@/types/api';
import { cn, EmptyState } from '@/ui/primitives';
import {
  control,
  controlIconWell,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { getHeroAccentTheme } from '@/ui/tokens';
import { fmtUSD } from '@/utils/format';

export interface FixedExpenseListProps {
  fixedExpenses: FixedExpenseSummary[];
  isLoading?: boolean;
}

const sectionBadgeClass = cn(uiTypographyRecipes.label, uiTextRecipes.muted);

function FixedExpenseCadenceGroupHeader({ cadence }: { cadence: FixedExpenseCadenceKey }) {
  return (
    <span className={cn(sectionBadgeClass, 'inline-flex items-center gap-2')}>
      <span className={cn(...controlIconWell.lg)}>
        <SubscriptionCadenceIcon cadence={cadence === 'biweekly' ? 'monthly' : cadence} />
      </span>
      {FIXED_EXPENSE_CADENCE_LABELS[cadence]}
    </span>
  );
}

function CategoryBadge({ category }: { category?: string }) {
  return (
    <span
      className={cn(
        uiTypographyRecipes.caption,
        uiTextRecipes.muted,
        'rounded-sm',
        'border',
        'border-current/20',
        'px-1.5',
        'py-0.5',
        'whitespace-nowrap',
        'shrink-0'
      )}
    >
      {category === 'bill' ? 'Bills' : 'Subscription'}
    </span>
  );
}

function FixedExpenseCard({ item }: { item: FixedExpenseSummary }) {
  const heroStyles = getHeroAccentTheme('sky');
  const dateRange = getSubscriptionDateRangeDisplay(item);
  const dateLabel = formatSubscriptionDateRangeLabel(item);
  const ringStyle = {
    '--tw-ring-color': `${heroStyles.ringHex}66`,
  } as CSSProperties;

  return (
    <li className={cn(heroStatCardRecipes.base, 'min-w-0', 'w-full')}>
      <div
        data-testid={`fixed-expense-card-${item.normalized_merchant}`}
        className={cn(
          heroStatCardRecipes.shell,
          heroStyles.border,
          heroStyles.borderDark,
          'flex w-full flex-col gap-1.5 !px-3.5 !py-2 text-left md:!px-4'
        )}
        style={ringStyle}
      >
        <div
          className={cn(
            'hero-stat-card__gradient',
            'pointer-events-none',
            'absolute',
            'inset-0',
            'rounded-[length:inherit]',
            'opacity-0',
            'group-hover:opacity-100',
            'transition-opacity',
            'duration-300'
          )}
          style={{
            background: `radial-gradient(ellipse at 50% 0%, rgba(${heroStyles.glowRgb},0.14) 0%, transparent 70%)`,
          }}
        />
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
          <div className={cn('flex', 'shrink-0', 'items-baseline', 'gap-1.5', 'whitespace-nowrap')}>
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
            title={dateLabel}
          >
            <CalendarClock className={cn(control.glyph.sm, 'shrink-0')} aria-hidden />
            {dateRange.since ? (
              <>
                <span className={cn('min-w-0', 'truncate')}>{dateRange.since}</span>
                <ArrowRight className={cn(control.glyph.sm, 'shrink-0')} aria-hidden />
                <span className={cn('shrink-0', 'whitespace-nowrap')}>{dateRange.nextDue}</span>
              </>
            ) : (
              <span className={cn('min-w-0', 'truncate')}>{dateRange.nextDue}</span>
            )}
          </div>
          <span className={cn('shrink-0', 'tabular-nums', 'whitespace-nowrap')}>
            {item.occurrence_count}
            <span className={cn(uiTypographyRecipes.caption, uiTextRecipes.body, 'ml-0.5')}>
              tx
            </span>
          </span>
          <CategoryBadge category={item.category} />
        </div>
      </div>
    </li>
  );
}

export function FixedExpenseList({ fixedExpenses, isLoading = false }: FixedExpenseListProps) {
  const grouped = groupFixedExpensesByCadence(fixedExpenses);

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
                <FixedExpenseCard key={item.normalized_merchant} item={item} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
