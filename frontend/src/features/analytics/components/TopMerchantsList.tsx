import { MapPin } from 'lucide-react';
import React, { type CSSProperties } from 'react';
import { cn, EmptyState } from '@/ui/primitives';
import {
  dashboardCategoryCard,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { useTheme } from '../../../context/ThemeContext';
import type { AnalyticsTopMerchantsResponse } from '../../../types/api';
import { fmtUSD } from '../../../utils/format';

type Props = {
  merchants: AnalyticsTopMerchantsResponse[];
  className?: string;
};

const merchantRow = [
  'flex items-center justify-between p-2',
  ...dashboardCategoryCard.shellInteractive,
] as const;

const TopMerchantsListFn: React.FC<Props> = ({ merchants, className = '' }) => {
  const { colors } = useTheme();
  const merchantsToShow = merchants.slice(0, 8);
  const hoverBorderStyle = {
    '--dashboard-category-card-hover-border': colors.chart.primary[0],
  } as CSSProperties;

  return (
    <div className={cn('h-full', 'flex', 'flex-col', className)}>
      {merchantsToShow.length > 0 ? (
        <div
          className={cn(
            'grid',
            'grid-cols-[repeat(auto-fit,minmax(min(100%,33rem),1fr))]',
            'gap-[length:var(--spacing-compact-gap)]'
          )}
        >
          {merchantsToShow.map((merchant) => (
            <div key={merchant.name} className={cn(merchantRow)} style={hoverBorderStyle}>
              <div className={cn('min-w-0', 'flex-1')}>
                <div
                  className={cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.primary, 'truncate')}
                >
                  {merchant.name}
                </div>
                <div className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                  {merchant.count} item{merchant.count !== 1 ? 's' : ''}
                </div>
              </div>
              <div className={cn('text-right', 'flex-shrink-0', 'ml-4')}>
                <div className={cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.primary)}>
                  {fmtUSD(merchant.amount)}
                </div>
                <div className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                  {merchant.percentage}%
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn('flex', 'items-center', 'justify-center', 'flex-1')}>
          <EmptyState
            icon={MapPin}
            title="No merchants ranked yet"
            description="No spending recorded for this period."
          />
        </div>
      )}
    </div>
  );
};
export const TopMerchantsList = React.memo(TopMerchantsListFn);
export default TopMerchantsList;
