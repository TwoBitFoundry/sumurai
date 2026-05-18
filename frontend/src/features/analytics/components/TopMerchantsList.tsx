import { MapPin } from 'lucide-react';
import type React from 'react';
import { cn, EmptyState } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  effect as uiEffectRecipes,
  radius as uiRadiusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { categoryAccents, chart } from '@/ui/tokens';
import type { AnalyticsTopMerchantsResponse } from '../../../types/api';
import { fmtUSD } from '../../../utils/format';

type Props = {
  merchants: AnalyticsTopMerchantsResponse[];
  className?: string;
};

const merchantRow = [
  `flex items-center justify-between ${uiRadiusRecipes.standard} border p-3 transition-all duration-300 hover:-translate-y-[2px]`,
  ...uiBorderRecipes.subtle,
  ...uiSurfaceRecipes.card,
  ...uiEffectRecipes.accentHover,
] as const;

export const TopMerchantsList: React.FC<Props> = ({ merchants, className = '' }) => {
  const merchantsToShow = merchants.slice(0, 6);

  return (
    <div className={cn('h-full', 'flex', 'flex-col', className)}>
      {merchantsToShow.length > 0 ? (
        <div className={cn('space-y-3')}>
          {merchantsToShow.map((merchant, index) => (
            <div key={merchant.name} className={cn(merchantRow)}>
              <div className={cn('flex', 'items-center', 'gap-3', 'min-w-0', 'flex-1')}>
                <div
                  className={cn(
                    'flex',
                    'items-center',
                    'justify-center',
                    'w-6',
                    'h-6',
                    'rounded-full',
                    'bg-gradient-to-r',
                    uiTextRecipes.primary,
                    uiTypographyRecipes.label,
                    'flex-shrink-0'
                  )}
                  style={{
                    backgroundImage: `linear-gradient(90deg, ${chart.series.light[0]}, ${chart.series.light[1]})`,
                    boxShadow: `0 0 0 1px ${categoryAccents[index % categoryAccents.length].ringHex}33`,
                  }}
                >
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div
                    className={cn(
                      uiTypographyRecipes.bodyStrong,
                      uiTextRecipes.primary,
                      'truncate'
                    )}
                  >
                    {merchant.name}
                  </div>
                  <div className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted)}>
                    {merchant.count} transaction{merchant.count !== 1 ? 's' : ''}
                  </div>
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
            title="No merchants found"
            description="No merchant data available for this period"
          />
        </div>
      )}
    </div>
  );
};

export default TopMerchantsList;
