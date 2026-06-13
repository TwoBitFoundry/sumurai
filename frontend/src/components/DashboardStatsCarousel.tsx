import { motion } from 'framer-motion';
import { Landmark, type LucideIcon, Waypoints } from 'lucide-react';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
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
  description: string;
}> = [
  {
    label: 'Money flow',
    icon: Waypoints,
    panelId: 'money-flow-panel',
    slideLabel: 'Money flow insight',
    description: 'Follow income and spending across your accounts.',
  },
  {
    label: 'Balances now',
    icon: Landmark,
    panelId: 'balance-overview-panel',
    slideLabel: 'Balances Now',
    description: 'Review cash, credit, and loan balances across connected accounts.',
  },
];
const panelFadeTransition = { duration: 0.15 } as const;

function subscribeMdViewport(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia('(min-width: 768px)');
  mediaQuery.addEventListener('change', onStoreChange);
  return () => mediaQuery.removeEventListener('change', onStoreChange);
}

function getMdViewportSnapshot() {
  return window.matchMedia('(min-width: 768px)').matches;
}

function useMdViewport() {
  return useSyncExternalStore(subscribeMdViewport, getMdViewportSnapshot, () => true);
}

export function DashboardStatsCarousel({ dateRange, className }: DashboardStatsCarouselProps) {
  const isMdUp = useMdViewport();
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

  const moneyFlowOpacity = isMdUp && selectedIndex === 0 ? 1 : 0;
  const balancesOpacity = isMdUp ? (selectedIndex === 1 ? 1 : 0) : 1;
  const activeSlideIndex = isMdUp ? selectedIndex : 1;
  const activeDescription = slides[activeSlideIndex]?.description;

  const slideTabs = (
    <div
      className={cn(
        'hidden',
        'md:flex',
        ...appTitleBarRecipes.pillContainer,
        ...appTitleBarRecipes.contextPillInset,
        ...appTitleBarRecipes.pillContainerSize,
        ...appTitleBarRecipes.tabBarShadow,
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
        description={activeDescription}
        refreshingLabel="Refreshing financial breakdown over time"
        isRefreshing={false}
        headerTrailing={slideTabs}
        bodyClassName={cn('gap-4')}
      >
        <div ref={panelStackRef} className={cn(...dashboardStatsCarousel.panelStack)}>
          <motion.section
            className={cn(
              'hidden',
              'md:flex',
              ...dashboardStatsCarousel.panel,
              selectedIndex === 0 ? dashboardStatsCarousel.panelActive : 'z-0'
            )}
            aria-label={slides[0].slideLabel}
            id={slides[0].panelId}
            role="tabpanel"
            aria-hidden={selectedIndex !== 0}
            initial={false}
            animate={{ opacity: moneyFlowOpacity }}
            transition={panelFadeTransition}
            style={{ pointerEvents: selectedIndex === 0 ? 'auto' : 'none' }}
          >
            <MoneyFlowSankeyChart
              dateRange={dateRange}
              className={cn('h-full', 'min-h-0', 'w-full')}
              containerSize={sankeyContainerSize}
            />
          </motion.section>
          <motion.section
            className={cn(
              ...dashboardStatsCarousel.panel,
              selectedIndex === 1 ? dashboardStatsCarousel.panelActive : 'z-0'
            )}
            aria-label={slides[1].slideLabel}
            id={slides[1].panelId}
            role="tabpanel"
            aria-hidden={selectedIndex !== 1}
            initial={false}
            animate={{ opacity: balancesOpacity }}
            transition={panelFadeTransition}
            style={{ pointerEvents: selectedIndex === 1 || !isMdUp ? 'auto' : 'none' }}
          >
            <BalancesOverviewChart />
          </motion.section>
        </div>
      </DashboardChartCard>
    </div>
  );
}

export default DashboardStatsCarousel;
