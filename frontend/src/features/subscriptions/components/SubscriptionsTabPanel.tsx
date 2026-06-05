import { CalendarClock, DollarSign, Repeat2, TrendingUp } from 'lucide-react';
import HeroStatCard from '@/components/widgets/HeroStatCard';
import { useSubscriptions } from '@/features/subscriptions/hooks/useSubscriptions';
import { PageLayout } from '@/layouts/PageLayout';
import { cn, GlassCard } from '@/ui/primitives';
import { fmtUSD } from '@/utils/format';
import { SubscriptionsSection } from './SubscriptionsSection';

interface SubscriptionsTabPanelProps {
  onNavigateToTransactions: (category: string, merchant: string) => void;
}

export function SubscriptionsTabPanel({ onNavigateToTransactions }: SubscriptionsTabPanelProps) {
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
            <SubscriptionsSection
              subscriptions={subscriptions}
              isLoading={isLoading}
              onSelect={(merchant) => onNavigateToTransactions('SUBSCRIPTION', merchant)}
            />
          </GlassCard>
        </div>
      </PageLayout>
    </div>
  );
}
