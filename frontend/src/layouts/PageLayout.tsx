import type { ReactNode } from 'react';
import { cn } from '@/ui/primitives/utils';
import {
  border as semanticBorders,
  effect as semanticEffects,
  status as semanticStatus,
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

export const pageLayoutRecipes = {
  shell: [
    'relative',
    'overflow-hidden',
    'rounded-[2.25rem]',
    'border',
    ...semanticBorders.glass,
    ...semanticSurfaces.glassPanel,
    'p-4',
    ...semanticEffects.glassShadow,
    'backdrop-blur-[28px]',
    'backdrop-saturate-[150%]',
    'transition-colors',
    'duration-500',
    'ease-out',
    'md:p-8',
    'lg:p-12',
  ],
  innerRing: [
    'absolute',
    'inset-[1px]',
    'rounded-[2.2rem]',
    'ring-1',
    'ring-white/45',
    ...semanticEffects.pageShellInsetRing,
    'dark:ring-white/12',
  ],
  innerGradient: [
    'absolute',
    'inset-0',
    'rounded-[2.2rem]',
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
  badge: `${uiTypographyRecipes.badge} inline-flex items-center justify-center rounded-full ${semanticSurfaces.mutedChip.join(' ')} px-3 py-1 ${semanticTextRecipes.label} ${semanticEffects.glassShadow[0]} dark:text-slate-200`,
  title: `${uiTypographyRecipes.pageTitle} ${semanticTextRecipes.primary} transition-colors duration-300 ease-out`,
  subtitle: `${uiTypographyRecipes.body} ${semanticTextRecipes.body} transition-colors duration-300 ease-out`,
  error: [
    'rounded-2xl',
    ...semanticBorders.danger,
    ...semanticStatus.danger.surface,
    'px-5 py-3',
    'shadow-sm',
  ].join(' '),
  errorText: `${uiTypographyRecipes.captionStrong} ${semanticTextRecipes.danger}`,
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
  return (
    <div className={cn('space-y-6', 'md:space-y-8', className)}>
      <section className={cn(...pageLayoutRecipes.shell)}>
        <div className={cn('pointer-events-none', 'absolute', 'inset-0')}>
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
              <div className={cn('flex', 'flex-wrap', 'items-center', 'justify-start', 'gap-3')}>
                {actions}
              </div>
            )}
          </div>

          {error && (
            <div className={cn(pageLayoutRecipes.error)}>
              <div className={cn(pageLayoutRecipes.errorText)}>Error: {error}</div>
            </div>
          )}

          {stats && stats}
        </div>
      </section>

      {children}
    </div>
  );
}

export default PageLayout;
