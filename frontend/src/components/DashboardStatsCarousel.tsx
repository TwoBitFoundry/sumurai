import type { EmblaCarouselType } from 'embla-carousel';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { BalancesOverviewChart } from '@/components/BalancesOverview';
import DashboardChartCard from '@/features/analytics/components/DashboardChartCard';
import { MoneyFlowSankeyChart } from '@/features/analytics/components/MoneyFlowSankeyChart';
import { useChartContainerSize } from '@/features/analytics/hooks/useChartContainerSize';
import { Button, cn } from '@/ui/primitives';
import { dashboardStatsCarousel } from '@/ui/recipes';
import type { DateRangeKey } from '@/utils/dateRanges';

type DashboardStatsCarouselProps = {
  dateRange: DateRangeKey;
  className?: string;
};

const slideLabels = ['Money flow', 'Balances Now'] as const;
const slidePanelIds = ['money-flow-panel', 'balance-overview-panel'] as const;
const financialBreakdownDescription =
  'Switch between wealth flow and balances by account. Investment and loan accounts are excluded from the flow view.';

function usePrevNextButtons(
  emblaApi: EmblaCarouselType | undefined,
  canScrollPrev: boolean,
  canScrollNext: boolean
) {
  const scrollPrev = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  return { canScrollPrev, canScrollNext, scrollPrev, scrollNext };
}

function useDotButton(
  emblaApi: EmblaCarouselType | undefined,
  selectedIndex: number,
  slideCount: number
) {
  const scrollTo = useCallback(
    (index: number) => {
      emblaApi?.scrollTo(index);
    },
    [emblaApi]
  );

  const dots = Array.from({ length: slideCount }, (_, index) => ({
    index,
    isSelected: index === selectedIndex,
    scrollTo,
  }));

  return { dots };
}

export function DashboardStatsCarousel({ dateRange, className }: DashboardStatsCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    watchDrag: useCallback((_api: EmblaCarouselType, evt: TouchEvent | MouseEvent) => {
      return evt.type.startsWith('touch');
    }, []),
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    const onSelect = (api: EmblaCarouselType) => {
      setSelectedIndex(api.selectedScrollSnap());
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    onSelect(emblaApi);
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi]);

  const { scrollPrev, scrollNext } = usePrevNextButtons(emblaApi, canScrollPrev, canScrollNext);
  const { dots } = useDotButton(emblaApi, selectedIndex, slideLabels.length);
  const { ref: trackMeasureRef, width: trackWidth, height: trackHeight } = useChartContainerSize();
  const sankeyContainerSize =
    trackWidth > 0 && trackHeight > 0 ? { width: trackWidth, height: trackHeight } : undefined;

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
        bodyClassName={cn('gap-4')}
      >
        <div className={cn('flex', 'justify-start')}>
          <div className={cn(...dashboardStatsCarousel.controls)}>
            <Button
              type="button"
              variant="icon"
              size="sm"
              shape="square"
              aria-label="Show previous financial breakdown slide"
              disabled={!canScrollPrev}
              onClick={scrollPrev}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="icon"
              size="sm"
              shape="square"
              aria-label="Show next financial breakdown slide"
              disabled={!canScrollNext}
              onClick={scrollNext}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>

        <section
          className={cn(...dashboardStatsCarousel.viewport)}
          aria-roledescription="carousel"
          aria-label="Financial breakdown carousel"
          ref={emblaRef}
        >
          <div ref={trackMeasureRef} className={cn(...dashboardStatsCarousel.track)}>
            <section
              className={cn(...dashboardStatsCarousel.slide)}
              aria-label="Money flow insight"
              id={slidePanelIds[0]}
            >
              <MoneyFlowSankeyChart
                dateRange={dateRange}
                containerSize={sankeyContainerSize}
                className={cn('h-full', 'min-h-0', 'w-full')}
              />
            </section>
            <section
              className={cn(...dashboardStatsCarousel.slide)}
              aria-label="Balances Now"
              id={slidePanelIds[1]}
            >
              <BalancesOverviewChart />
            </section>
          </div>
        </section>

        <div
          className={cn(...dashboardStatsCarousel.dots)}
          role="tablist"
          aria-label="Financial breakdown"
        >
          {dots.map((dot) => (
            <button
              key={dot.index}
              type="button"
              role="tab"
              aria-label={`Show ${slideLabels[dot.index].toLowerCase()}`}
              aria-selected={dot.isSelected}
              aria-controls={slidePanelIds[dot.index]}
              className={cn(
                ...dashboardStatsCarousel.dot,
                dot.isSelected
                  ? 'border-[var(--color-brand-sky)] bg-[var(--color-brand-sky)] shadow-[0_0_0_6px_color-mix(in_srgb,var(--color-brand-sky)_14%,transparent)]'
                  : 'border-[var(--color-border-control)] bg-[var(--color-surface-muted)]'
              )}
              onClick={() => dot.scrollTo(dot.index)}
            />
          ))}
        </div>
      </DashboardChartCard>
    </div>
  );
}

export default DashboardStatsCarousel;
