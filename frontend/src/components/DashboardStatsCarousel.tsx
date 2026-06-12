import { Landmark, type LucideIcon, Waypoints } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { BalancesOverviewChart } from '@/components/BalancesOverview';
import DashboardChartCard from '@/features/analytics/components/DashboardChartCard';
import { MoneyFlowSankeyChart } from '@/features/analytics/components/MoneyFlowSankeyChart';
import { useChartContainerSize } from '@/features/analytics/hooks/useChartContainerSize';
import { useDebouncedChartRecalc } from '@/features/analytics/hooks/useDebouncedChartRecalc';
import { Button, cn } from '@/ui/primitives';
import { appTitleBarRecipes } from '@/ui/primitives/AppTitleBar';
import { dashboardStatsCarousel, text as uiTextRecipes } from '@/ui/recipes';
import type { DateRangeKey } from '@/utils/dateRanges';

type DashboardStatsCarouselProps = {
  dateRange: DateRangeKey;
  className?: string;
};

const slides: Array<{
  label: string;
  icon: LucideIcon;
  panelId: string;
  slideLabel: string;
}> = [
  {
    label: 'Money flow',
    icon: Waypoints,
    panelId: 'money-flow-panel',
    slideLabel: 'Money flow insight',
  },
  {
    label: 'Balances now',
    icon: Landmark,
    panelId: 'balance-overview-panel',
    slideLabel: 'Balances Now',
  },
];
const financialBreakdownDescription = 'Switch between wealth flow and balances by account.';

export function DashboardStatsCarousel({ dateRange, className }: DashboardStatsCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const {
    ref: panelStackRef,
    width: panelStackWidth,
    height: panelStackHeight,
  } = useChartContainerSize();
  const sankeyContainerSizeRaw = useMemo(
    () =>
      panelStackWidth > 0 && panelStackHeight > 0
        ? { width: panelStackWidth, height: panelStackHeight }
        : undefined,
    [panelStackWidth, panelStackHeight]
  );
  const sankeyContainerSize = useDebouncedChartRecalc(sankeyContainerSizeRaw);

  const scrollToSlide = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const slideTabs = (
    <div
      className={cn(
        'hidden',
        'md:flex',
        ...appTitleBarRecipes.pillContainer,
        ...appTitleBarRecipes.contextPillInset,
        ...appTitleBarRecipes.pillContainerSize,
        'shrink-0'
      )}
      role="tablist"
      aria-label="Financial breakdown"
    >
      {slides.map((slide, index) => {
        const isSelected = index === selectedIndex;
        const Icon = slide.icon;

        return (
          <Button
            key={slide.panelId}
            type="button"
            role="tab"
            variant={isSelected ? 'tabActive' : 'tab'}
            size="inherit"
            className={cn(
              ...appTitleBarRecipes.contextPillTab,
              'shrink-0',
              isSelected
                ? [...appTitleBarRecipes.contextPillTabSize, uiTextRecipes.inverse]
                : ['!px-0', 'aspect-square', '!gap-0', uiTextRecipes.muted]
            )}
            aria-label={`Show ${slide.label.toLowerCase()}`}
            aria-selected={isSelected}
            aria-controls={slide.panelId}
            onClick={() => scrollToSlide(index)}
          >
            <span
              className={cn('relative', 'z-10', 'shrink-0', ...appTitleBarRecipes.pillTabIconWell)}
            >
              <Icon className={cn(...appTitleBarRecipes.pillTabIcon)} aria-hidden />
            </span>
          </Button>
        );
      })}
    </div>
  );

  return (
    <div
      className={cn(...dashboardStatsCarousel.shell, className)}
      data-testid="dashboard-stats-carousel"
    >
      <DashboardChartCard
        title="Financial breakdown over time"
        description={financialBreakdownDescription}
        refreshingLabel="Refreshing financial breakdown over time"
        isRefreshing={false}
        headerTrailing={slideTabs}
        bodyClassName={cn('gap-4')}
      >
        <div ref={panelStackRef} className={cn(...dashboardStatsCarousel.panelStack)}>
          <section
            className={cn(
              'hidden',
              'md:flex',
              ...dashboardStatsCarousel.panel,
              selectedIndex === 0
                ? dashboardStatsCarousel.panelActive
                : dashboardStatsCarousel.panelHidden
            )}
            aria-label={slides[0].slideLabel}
            id={slides[0].panelId}
            role="tabpanel"
            aria-hidden={selectedIndex !== 0}
          >
            <MoneyFlowSankeyChart
              dateRange={dateRange}
              className={cn('h-full', 'min-h-0', 'w-full')}
              containerSize={sankeyContainerSize}
            />
          </section>
          <section
            className={cn(
              ...dashboardStatsCarousel.panel,
              selectedIndex === 1
                ? dashboardStatsCarousel.panelActive
                : ['md:invisible', 'md:pointer-events-none', 'z-0']
            )}
            aria-label={slides[1].slideLabel}
            id={slides[1].panelId}
            role="tabpanel"
            aria-hidden={selectedIndex !== 1}
          >
            <BalancesOverviewChart />
          </section>
        </div>
      </DashboardChartCard>
    </div>
  );
}

export default DashboardStatsCarousel;
