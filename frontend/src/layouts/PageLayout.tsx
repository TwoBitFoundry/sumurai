import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/ui/primitives/utils';
import {
  border as semanticBorders,
  effect as semanticEffects,
  status as semanticStatus,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  radius as uiRadiusRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

export const pageLayoutRecipes = {
  shell: ['relative', 'p-4', 'md:p-8', 'lg:p-8'],
  shellSurface: [
    'pointer-events-none',
    'absolute',
    'inset-0',
    uiRadiusRecipes.standard,
    'border',
    ...semanticBorders.glass,
    ...semanticSurfaces.glassPanel,
    ...semanticEffects.glassElevationShadow,
    ...semanticEffects.glassBackdrop,
    'overflow-hidden',
    'transition-colors',
    'duration-500',
    'ease-out',
  ],
  innerRing: [
    'absolute',
    'inset-[1px]',
    uiRadiusRecipes.standard,
    'ring-1',
    'ring-white/45',
    'dark:ring-white/12',
  ],
  innerGradient: [
    'absolute',
    'inset-0',
    uiRadiusRecipes.standard,
    'bg-gradient-to-b',
    'from-white/72',
    'via-white/28',
    'to-transparent',
    'transition-colors',
    'duration-500',
    'dark:from-slate-900/68',
    'dark:via-slate-900/34',
    'dark:to-transparent',
  ],
  badge: `${uiTypographyRecipes.badge} inline-flex items-center justify-center rounded-full ${semanticSurfaces.mutedChip.join(' ')} px-3 py-1 ${semanticTextRecipes.label} ${semanticEffects.glassDropShadow[0]} dark:text-slate-200`,
  title: `${uiTypographyRecipes.pageTitle} ${semanticTextRecipes.primary} transition-colors duration-300 ease-out`,
  subtitle: `${uiTypographyRecipes.body} ${semanticTextRecipes.body} transition-colors duration-300 ease-out`,
  error: [
    uiRadiusRecipes.standard,
    ...semanticBorders.danger,
    ...semanticStatus.danger.surface,
    ...semanticEffects.glassDropShadow,
    'px-5 py-3',
  ].join(' '),
  errorText: `${uiTypographyRecipes.captionStrong} ${semanticTextRecipes.danger}`,
  settingsShell: ['mx-auto', 'w-full', 'max-w-3xl'],
  stickyScope: ['flex', 'min-w-0', 'flex-col'],
  stickyStatsOverlap: [
    '-mt-[calc(var(--page-layout-stats-height,0px)+2.5rem)]',
    'md:-mt-[calc(var(--page-layout-stats-height,0px)+4rem)]',
  ],
  stickyStatsInset: [
    '[&_[data-page-layout-stats-host]>*]:mx-4',
    'md:[&_[data-page-layout-stats-host]>*]:mx-8',
  ],
  stickyContentGap: ['mt-10', 'md:mt-16'],
} as const;

interface PageLayoutProps {
  badge?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  stats?: ReactNode;
  error?: string | null;
  children?: ReactNode;
  className?: string;
}

export function PageLayout({
  badge,
  title,
  subtitle,
  actions,
  stats,
  error,
  children,
  className,
}: PageLayoutProps) {
  const statsHostRef = useRef<HTMLDivElement>(null);
  const [statsHeight, setStatsHeight] = useState(0);
  const layoutStyle = {
    '--page-layout-stats-height': statsHeight > 0 ? `${statsHeight}px` : undefined,
  } as CSSProperties;

  useEffect(() => {
    if (!stats) {
      setStatsHeight(0);
      return;
    }

    const statsElement = statsHostRef.current?.firstElementChild;
    if (!statsElement) return;

    const updateStatsHeight = () => {
      setStatsHeight(statsElement.getBoundingClientRect().height);
    };

    updateStatsHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateStatsHeight);
    observer.observe(statsElement);

    return () => observer.disconnect();
  }, [stats]);

  return (
    <div className={cn('flex', 'flex-col', 'gap-6', 'md:gap-8', className)} style={layoutStyle}>
      <section className={cn(...pageLayoutRecipes.shell)}>
        <div className={cn(pageLayoutRecipes.shellSurface)}>
          <div className={cn(pageLayoutRecipes.innerRing)} />
          <div className={cn(pageLayoutRecipes.innerGradient)} />
        </div>

        <div className={cn('relative', 'z-10', 'flex', 'flex-col', 'gap-5')}>
          <div
            className={cn(
              'flex',
              'flex-col',
              'gap-5',
              'lg:flex-row',
              'lg:items-start',
              'lg:justify-between'
            )}
          >
            <div className={cn('max-w-2xl', 'space-y-3')}>
              {badge && <span className={cn(pageLayoutRecipes.badge)}>{badge}</span>}
              <div className="space-y-2">
                <h1 className={cn(pageLayoutRecipes.title)}>{title}</h1>
                {subtitle && <p className={cn(pageLayoutRecipes.subtitle)}>{subtitle}</p>}
              </div>
            </div>

            {actions && (
              <div className={cn('flex', 'flex-wrap', 'items-center', 'justify-between', 'gap-3')}>
                {actions}
              </div>
            )}
          </div>

          {error && (
            <div className={cn(pageLayoutRecipes.error)}>
              <div className={cn(pageLayoutRecipes.errorText)}>Error: {error}</div>
            </div>
          )}

          {stats ? (
            <div
              aria-hidden
              data-testid="page-layout-stats-placeholder"
              className={cn('pointer-events-none', 'invisible')}
              style={{ height: 'var(--page-layout-stats-height, 0px)' }}
            />
          ) : null}
        </div>
      </section>

      {stats || children ? (
        <div
          className={cn(
            ...pageLayoutRecipes.stickyScope,
            stats && pageLayoutRecipes.stickyStatsOverlap,
            stats && pageLayoutRecipes.stickyStatsInset
          )}
          data-testid="page-layout-sticky-scope"
        >
          {stats ? (
            <div ref={statsHostRef} className={cn('contents')} data-page-layout-stats-host>
              {stats}
            </div>
          ) : null}
          {children ? (
            <div
              className={cn(
                'w-full',
                'min-w-0',
                'max-w-full',
                stats && pageLayoutRecipes.stickyContentGap
              )}
            >
              {children}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default PageLayout;
