import type { ReactNode } from 'react';
import { cn } from '@/ui/primitives/utils';
import {
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  radius as uiRadiusRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { HeroSubtitleInfo } from './HeroSubtitleInfo';

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
  badge: `${uiTypographyRecipes.badge} inline-flex items-center justify-center rounded-full ${semanticSurfaces.mutedChip.join(' ')} px-3 py-1 ${semanticTextRecipes.label} ${semanticEffects.glassDropShadow[0]} dark:text-[color:color-mix(in_srgb,var(--color-brand-fog)_90%,var(--color-brand-navy))]`,
  title: `${uiTypographyRecipes.pageTitle} ${semanticTextRecipes.primary} transition-colors duration-300 ease-out`,
  titleInlineHost: [
    'inline',
    'min-w-0',
    'max-w-full',
    uiTypographyRecipes.pageTitle,
    semanticTextRecipes.primary,
    'transition-colors',
    'duration-300',
    'ease-out',
  ],
  titleInlineHeading: 'inline',
  subtitle: `${uiTypographyRecipes.body} ${semanticTextRecipes.body} transition-colors duration-300 ease-out`,
  settingsShell: ['mx-auto', 'w-full', 'max-w-3xl'],
  floatingChromeTail: ['max-md:pb-6'],
} as const;

interface PageLayoutProps {
  badge?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  stats?: ReactNode;
  children?: ReactNode;
  className?: string;
  hideHero?: boolean;
}

export function PageLayout({
  badge,
  title,
  subtitle,
  actions,
  stats,
  children,
  className,
  hideHero = false,
}: PageLayoutProps) {
  return (
    <div className={cn('flex', 'flex-col', 'gap-6', 'md:gap-8', className)}>
      {!hideHero ? (
        <section className={cn(...pageLayoutRecipes.shell)}>
          <div className={cn(pageLayoutRecipes.shellSurface)}>
            <div className={cn(pageLayoutRecipes.innerRing)} />
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
                  <div className={cn(...pageLayoutRecipes.titleInlineHost)}>
                    <h1 className={cn(pageLayoutRecipes.titleInlineHeading)}>{title}</h1>
                    {subtitle ? (
                      <>
                        {' '}
                        <HeroSubtitleInfo pageTitle={title} subtitle={subtitle} />
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {actions && (
                <div
                  className={cn('flex', 'flex-wrap', 'items-center', 'justify-between', 'gap-3')}
                >
                  {actions}
                </div>
              )}
            </div>

            {stats}
          </div>
        </section>
      ) : null}

      {children ? (
        <div className={cn('w-full', 'min-w-0', 'max-w-full')} data-testid="page-layout-content">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default PageLayout;
