import { CalendarClock, DollarSign, Repeat2, TrendingUp } from 'lucide-react';
import type { CSSProperties } from 'react';
import { cn, EmptyState, GlassCard } from '@/ui/primitives';
import HeroStatCard, { heroStatCardRecipes } from '../components/widgets/HeroStatCard';
import { useSubscriptions } from '../features/subscriptions/hooks/useSubscriptions';
import { PageLayout } from '../layouts/PageLayout';
import {
  border as semanticBorders,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '../ui/recipes';
import { getHeroAccentForCategoryKey, getHeroAccentTheme } from '../ui/tokens';
import { getTagThemeForCategory } from '../utils/categories';
import { fmtUSD } from '../utils/format';

interface SubscriptionsPageProps {
  onNavigateToTransactions: (category: string, merchant: string) => void;
}

export default function SubscriptionsPage({ onNavigateToTransactions }: SubscriptionsPageProps) {
  const { isLoading, error, subscriptions } = useSubscriptions();

  const monthlyTotal = subscriptions.reduce((sum, s) => sum + parseFloat(s.monthly_cost), 0);
  const largest = subscriptions.reduce<number>(
    (max, s) => Math.max(max, parseFloat(s.monthly_cost)),
    0
  );
  const annualized = monthlyTotal * 12;

  const heroStats = (
    <div className={cn('grid', 'grid-cols-2', 'gap-3', '[&>*]:min-w-0', 'lg:grid-cols-4')}>
      <HeroStatCard
        index={1}
        title="Monthly recurring"
        icon={<Repeat2 />}
        value={fmtUSD(monthlyTotal)}
        suffix="per month"
      />
      <HeroStatCard
        index={2}
        title="Active subscriptions"
        icon={<DollarSign />}
        value={`${subscriptions.length}`}
        suffix="detected"
      />
      <HeroStatCard
        index={3}
        title="Largest"
        icon={<TrendingUp />}
        value={fmtUSD(largest)}
        suffix="per month"
      />
      <HeroStatCard
        index={4}
        title="Annualized"
        icon={<CalendarClock />}
        value={fmtUSD(annualized)}
        suffix="per year"
      />
    </div>
  );

  return (
    <div data-testid="subscriptions-page">
      <PageLayout
        badge="Subscriptions"
        title="Know your recurring spend"
        subtitle="Every subscription detected from your transaction history, grouped and priced at monthly rate."
        error={error}
        stats={heroStats}
      >
        <div className={cn('w-full', 'min-w-0', 'max-w-full')}>
          <GlassCard
            variant="accent"
            rounded="lg"
            padding="none"
            withInnerEffects={false}
            containerClassName={cn('p-4', 'md:p-8', 'lg:p-8')}
            className={cn('space-y-6')}
          >
            {isLoading || subscriptions.length > 0 ? (
              <ul
                className={cn('grid', 'grid-cols-1', 'gap-4', 'md:grid-cols-2', 'lg:grid-cols-3')}
              >
                {subscriptions.map((s) => {
                  const tagTheme = getTagThemeForCategory('SUBSCRIPTION');
                  const heroStyles = getHeroAccentTheme(getHeroAccentForCategoryKey(tagTheme.key));
                  const ringStyle = {
                    '--tw-ring-color': `${heroStyles.ringHex}66`,
                  } as CSSProperties;

                  return (
                    <li key={s.normalized_merchant} className={cn(heroStatCardRecipes.base)}>
                      <button
                        type="button"
                        data-testid={`subscription-card-${s.normalized_merchant}`}
                        onClick={() => onNavigateToTransactions('SUBSCRIPTION', s.merchant)}
                        className={cn(
                          heroStatCardRecipes.shell,
                          heroStyles.border,
                          heroStyles.borderDark,
                          heroStyles.hoverBorder,
                          heroStyles.hoverBorderDark,
                          'flex w-full flex-col gap-2 p-3.5 pt-4 text-left cursor-pointer',
                          'hover:ring-2',
                          heroStyles.hoverBorder
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
                        <div className={cn('flex', 'items-start', 'justify-between', 'gap-2')}>
                          <span
                            className={cn(
                              uiTypographyRecipes.bodyStrong,
                              uiTextRecipes.primary,
                              'truncate'
                            )}
                          >
                            {s.merchant}
                          </span>
                          <span
                            className={cn(
                              uiTypographyRecipes.badge,
                              'shrink-0',
                              'rounded-full',
                              'px-2',
                              'py-0.5',
                              tagTheme.tag
                            )}
                          >
                            {s.cadence}
                          </span>
                        </div>
                        <div className={cn('flex', 'items-baseline', 'gap-1.5')}>
                          <span
                            className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}
                          >
                            {fmtUSD(s.monthly_cost)}
                          </span>
                          <span className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                            / mo
                          </span>
                        </div>
                        <div
                          className={cn(
                            'flex',
                            'items-center',
                            'gap-1',
                            uiTypographyRecipes.caption,
                            uiTextRecipes.subtle,
                            'border-t',
                            'pt-2',
                            ...semanticBorders.subtle
                          )}
                        >
                          <CalendarClock className={cn('h-3', 'w-3', 'shrink-0')} />
                          <span>{s.last_charged}</span>
                          <span className={cn('ml-auto')}>{s.occurrence_count}×</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={Repeat2}
                title="No subscriptions detected"
                description="Subscriptions are detected automatically after a sync or categorization run."
                data-testid="subscriptions-empty-state"
              />
            )}
          </GlassCard>
        </div>
      </PageLayout>
    </div>
  );
}
