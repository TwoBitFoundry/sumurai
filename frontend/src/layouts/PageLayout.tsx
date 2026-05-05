import type { ReactNode } from 'react';
import { designTokens } from '@/ui/tokens';
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
      <section
        className={cn(
          ...designTokens.components.pageLayout.shell
        )}
      >
        <div className={cn('pointer-events-none', 'absolute', 'inset-0')}>
          <div
            className={cn(...designTokens.components.pageLayout.innerRing.split(' '))}
          />
          <div
            className={cn(...designTokens.components.pageLayout.innerGradient.split(' '))}
          />
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
              {badge && (
                <span
                  className={cn(designTokens.components.pageLayout.badge)}
                >
                  {badge}
                </span>
              )}
              <div className="space-y-2">
                <h1
                  className={cn(designTokens.components.pageLayout.title)}
                >
                  {title}
                </h1>
                {subtitle && (
                  <p
                    className={cn(designTokens.components.pageLayout.subtitle)}
                  >
                    {subtitle}
                  </p>
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
            <div
              className={cn(designTokens.components.pageLayout.error)}
            >
              <div className={cn(designTokens.components.pageLayout.errorText)}>
                Error: {error}
              </div>
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
