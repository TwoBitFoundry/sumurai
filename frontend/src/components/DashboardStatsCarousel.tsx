import DashboardChartCard from '@/features/analytics/components/DashboardChartCard';
import { MoneyFlowSankeyChart } from '@/features/analytics/components/MoneyFlowSankeyChart';
import { useChartContainerSize } from '@/features/analytics/hooks/useChartContainerSize';
import { useDebouncedChartRecalc } from '@/features/analytics/hooks/useDebouncedChartRecalc';
import { cn } from '@/ui/primitives';
import { dashboardStatsCarousel } from '@/ui/recipes';
import type { DateRangeKey } from '@/utils/dateRanges';

type DashboardStatsCarouselProps = {
  dateRange: DateRangeKey;
  className?: string;
};

export function DashboardStatsCarousel({ dateRange, className }: DashboardStatsCarouselProps) {
  const { ref: panelStackRef, width: panelStackWidth } = useChartContainerSize();
  const sankeyContainerSizeRaw = panelStackWidth > 0 ? { width: panelStackWidth } : undefined;
  const sankeyContainerSize = useDebouncedChartRecalc(sankeyContainerSizeRaw);

  return (
    <div
      className={cn(...dashboardStatsCarousel.shell, 'hidden md:flex', className)}
      data-testid="dashboard-stats-carousel"
    >
      <DashboardChartCard
        title="Financial breakdown over time"
        refreshingLabel="Refreshing financial breakdown over time"
        isRefreshing={false}
        bodyClassName={cn('gap-4')}
      >
        <div ref={panelStackRef} className={cn(...dashboardStatsCarousel.panelStack)}>
          <section
            className={cn(...dashboardStatsCarousel.panel, dashboardStatsCarousel.panelActive)}
            aria-label="Money flow insight"
            id="money-flow-panel"
          >
            <MoneyFlowSankeyChart
              dateRange={dateRange}
              className={cn('h-full', 'min-h-0', 'w-full')}
              containerSize={sankeyContainerSize}
            />
          </section>
        </div>
      </DashboardChartCard>
    </div>
  );
}

export default DashboardStatsCarousel;
