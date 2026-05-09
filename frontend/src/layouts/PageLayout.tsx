import type { ReactNode } from 'react';
import { primitiveTokenRecipes } from '@/ui/primitives/recipes';
import { cn } from '@/ui/primitives/utils';

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
    <div className={cn('space-y-8', className)}>
      <section className={cn(...primitiveTokenRecipes.pageLayout.shell)}>
        <div className={cn('pointer-events-none', 'absolute', 'inset-0')}>
          <div className={cn(primitiveTokenRecipes.pageLayout.innerRing)} />
          <div className={cn(primitiveTokenRecipes.pageLayout.innerGradient)} />
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
              {badge && <span className={cn(primitiveTokenRecipes.pageLayout.badge)}>{badge}</span>}
              <div className="space-y-2">
                <h1 className={cn(primitiveTokenRecipes.pageLayout.title)}>{title}</h1>
                {subtitle && (
                  <p className={cn(primitiveTokenRecipes.pageLayout.subtitle)}>{subtitle}</p>
                )}
              </div>
            </div>

            {actions && (
              <div className={cn('flex', 'flex-wrap', 'items-center', 'justify-start', 'gap-3')}>
                {actions}
              </div>
            )}
          </div>

          {error && (
            <div className={cn(primitiveTokenRecipes.pageLayout.error)}>
              <div className={cn(primitiveTokenRecipes.pageLayout.errorText)}>Error: {error}</div>
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
