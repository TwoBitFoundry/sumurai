import { ChevronRight, RefreshCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn, GlassCard } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

interface DashboardChartCardProps {
  title: string;
  description?: string;
  refreshingLabel: string;
  isRefreshing: boolean;
  className?: string;
  bodyClassName?: string;
  headerAction?: {
    label: string;
    onClick: () => void;
  };
  children: ReactNode;
}

export const DashboardChartCard = ({
  title,
  description,
  refreshingLabel,
  isRefreshing,
  className,
  bodyClassName,
  headerAction,
  children,
}: DashboardChartCardProps) => {
  return (
    <GlassCard
      padding="none"
      containerClassName={cn(
        'h-full',
        'overflow-visible',
        'p-4',
        'pt-5',
        'md:p-8',
        'lg:p-8',
        className
      )}
      className={cn('flex', 'h-full', 'min-h-0', 'flex-col', 'overflow-visible')}
    >
      <div className={cn('mb-3', 'md:mb-4', 'flex', 'items-center', 'justify-between')}>
        <div>
          <h3 className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}>{title}</h3>
          {description && (
            <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>{description}</p>
          )}
        </div>
        <div className={cn('flex', 'items-center', 'gap-2')}>
          {headerAction && (
            <button
              type="button"
              onClick={headerAction.onClick}
              className={cn(
                'flex',
                'items-center',
                'gap-1',
                'text-sm',
                uiTextRecipes.muted,
                'hover:text-primary',
                'transition-colors'
              )}
            >
              {headerAction.label}
              <ChevronRight className={cn('h-4', 'w-4')} />
            </button>
          )}
          {isRefreshing && (
            <RefreshCcw
              aria-label={refreshingLabel}
              className={cn('h-4', 'w-4', uiTextRecipes.subtle, 'animate-spin')}
            />
          )}
        </div>
      </div>
      <div
        className={cn(
          'flex',
          'min-h-[30px]',
          'flex-1',
          'flex-col',
          'min-w-0',
          'overflow-visible',
          bodyClassName
        )}
      >
        {children}
      </div>
    </GlassCard>
  );
};

export default DashboardChartCard;
