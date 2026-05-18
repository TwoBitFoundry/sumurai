import { RefreshCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn, GlassCard } from '@/ui/primitives';
import { text as uiTextRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

interface DashboardChartCardProps {
  title: string;
  description: string;
  refreshingLabel: string;
  isRefreshing: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export const DashboardChartCard = ({
  title,
  description,
  refreshingLabel,
  isRefreshing,
  className,
  bodyClassName,
  children,
}: DashboardChartCardProps) => {
  return (
    <GlassCard className={cn('h-full', 'flex', 'flex-col', 'p-4', 'md:p-6', className)}>
      <div className={cn('mb-3', 'md:mb-4', 'flex', 'items-center', 'justify-between')}>
        <div>
          <h3 className={cn(uiTypographyRecipes.cardTitle, uiTextRecipes.primary)}>{title}</h3>
          <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>{description}</p>
        </div>
        {isRefreshing && (
          <RefreshCcw
            aria-label={refreshingLabel}
            className={cn('h-4', 'w-4', uiTextRecipes.subtle, 'animate-spin')}
          />
        )}
      </div>
      <div className={cn('flex-1', 'min-h-0', 'min-w-0', bodyClassName)}>{children}</div>
    </GlassCard>
  );
};

export default DashboardChartCard;
