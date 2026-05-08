import { RefreshCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn, GlassCard } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';

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
    <GlassCard className={cn('p-6', 'h-full', 'flex', 'flex-col', className)}>
      <div className={cn('mb-4', 'flex', 'items-center', 'justify-between')}>
        <div>
          <h3
            className={cn(
              designTokens.typography.cardTitle,
              'text-slate-900',
              'dark:text-slate-100'
            )}
          >
            {title}
          </h3>
          <p
            className={cn(designTokens.typography.caption, 'text-slate-600', 'dark:text-slate-400')}
          >
            {description}
          </p>
        </div>
        {isRefreshing && (
          <RefreshCcw
            aria-label={refreshingLabel}
            className={cn('h-4', 'w-4', 'text-slate-500', 'dark:text-slate-400', 'animate-spin')}
          />
        )}
      </div>
      <div className={cn('flex-1', 'min-h-0', 'min-w-0', bodyClassName)}>{children}</div>
    </GlassCard>
  );
};

export default DashboardChartCard;
