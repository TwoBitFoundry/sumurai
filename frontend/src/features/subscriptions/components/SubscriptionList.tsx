import { ArrowRight, CalendarClock, Repeat2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { SubscriptionCadenceIcon } from '@/components/SubscriptionCadenceIcon';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import {
  groupSubscriptionsByCadence,
  SUBSCRIPTION_CADENCE_LABELS,
  SUBSCRIPTION_CADENCE_ORDER,
  type SubscriptionCadenceKey,
} from '@/domain/subscriptionCadences';
import {
  formatSubscriptionDateRangeLabel,
  getSubscriptionDateRangeDisplay,
} from '@/domain/subscriptionDates';
import type { SubscriptionSummary } from '@/types/api';
import { cn, EmptyState } from '@/ui/primitives';
import {
  control,
  controlIconWell,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { getHeroAccentTheme } from '@/ui/tokens';
import { fmtUSD } from '@/utils/format';

export interface SubscriptionListProps {
  subscriptions: SubscriptionSummary[];
  isLoading?: boolean;
}

const sectionBadgeClass = cn(uiTypographyRecipes.label, uiTextRecipes.muted);

function SubscriptionCadenceGroupHeader({ cadence }: { cadence: SubscriptionCadenceKey }) {
  return (
    <span className={cn(sectionBadgeClass, 'inline-flex items-center gap-2')}>
      <span className={cn(...controlIconWell.lg)}>
        <SubscriptionCadenceIcon cadence={cadence} />
      </span>
      {SUBSCRIPTION_CADENCE_LABELS[cadence]}
    </span>
  );
}

function SubscriptionCard({ subscription }: { subscription: SubscriptionSummary }) {
  const heroStyles = getHeroAccentTheme('sky');
  const dateRange = getSubscriptionDateRangeDisplay(subscription);
  const dateLabel = formatSubscriptionDateRangeLabel(subscription);
  const ringStyle = {
    '--tw-ring-color': `${heroStyles.ringHex}66`,
  } as CSSProperties;

  return (
    <li className={cn(heroStatCardRecipes.base, 'min-w-0', 'w-full')}>
      <div
        data-testid={`subscription-card-${subscription.normalized_merchant}`}
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
            {subscription.merchant}
          </span>
          <div className={cn('flex', 'shrink-0', 'items-baseline', 'gap-1.5', 'whitespace-nowrap')}>
            <span className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}>
              {fmtUSD(subscription.monthly_cost)}
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
            {subscription.occurrence_count}
            <span className={cn(uiTypographyRecipes.caption, uiTextRecipes.body, 'ml-0.5')}>
              tx
            </span>
          </span>
        </div>
      </div>
    </li>
  );
}

export function SubscriptionList({ subscriptions, isLoading = false }: SubscriptionListProps) {
  const groupedSubscriptions = groupSubscriptionsByCadence(subscriptions);

  if (!isLoading && subscriptions.length === 0) {
    return (
      <EmptyState
        icon={Repeat2}
        title="No subscriptions detected"
        description="Subscriptions are detected automatically after a sync or categorization run."
        data-testid="subscriptions-empty-state"
      />
    );
  }

  return (
    <div className={cn('space-y-6')} data-testid="subscription-cadence-groups">
      {SUBSCRIPTION_CADENCE_ORDER.map((cadence) => {
        const cadenceSubscriptions = groupedSubscriptions[cadence];
        if (cadenceSubscriptions.length === 0) {
          return null;
        }

        return (
          <section
            key={cadence}
            className={cn('space-y-3')}
            data-testid={`subscription-cadence-group-${cadence}`}
          >
            <SubscriptionCadenceGroupHeader cadence={cadence} />
            <ul className={cn('grid', 'grid-cols-1', 'gap-3', 'md:grid-cols-2', 'lg:grid-cols-3')}>
              {cadenceSubscriptions.map((subscription) => (
                <SubscriptionCard
                  key={subscription.normalized_merchant}
                  subscription={subscription}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
