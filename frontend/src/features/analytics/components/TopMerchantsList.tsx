import { MapPin } from 'lucide-react';
import React, { type CSSProperties, useRef } from 'react';
import { heroStatCardRecipes } from '@/components/widgets/HeroStatCard';
import { useTransactionListLauncher } from '@/features/transactions/hooks/useTransactionListLauncher';
import { cn, EmptyState } from '@/ui/primitives';
import {
  dashboardCategoryCard,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';
import type { AnalyticsTopMerchantsResponse } from '../../../types/api';
import { fmtUSD } from '../../../utils/format';
import { ChartFadePresence } from './ChartFadePresence';

type Props = {
  merchants: AnalyticsTopMerchantsResponse[];
  className?: string;
};

const merchantHoverRingStyle = {
  boxShadow: `inset 0 0 0 2px ${heroAccents.ocean.ringHex}`,
} as CSSProperties;

const merchantRowShell = [
  'relative',
  'overflow-hidden',
  'p-2',
  ...dashboardCategoryCard.shell,
] as const;

const merchantRowGrid = [
  'relative',
  'z-10',
  'grid',
  'grid-cols-[minmax(0,1fr)_auto_auto]',
  'items-stretch',
  'gap-x-3',
] as const;

const triggerFocusRing = [
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-inset',
  'focus-visible:ring-[var(--color-border-focus-active)]',
] as const;

function MerchantCard({ merchant }: { merchant: AnalyticsTopMerchantsResponse }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { openTransactionList } = useTransactionListLauncher();

  const handleOpen = () => {
    openTransactionList({ type: 'merchant', merchant: merchant.name }, cardRef);
  };

  return (
    <div
      ref={cardRef}
      key={merchant.name}
      className={cn(heroStatCardRecipes.base, merchantRowShell, 'cursor-pointer', triggerFocusRing)}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      }}
    >
      <div
        aria-hidden
        className={cn(...dashboardCategoryCard.insetRing)}
        style={merchantHoverRingStyle}
      />
      <div className={cn(merchantRowGrid)}>
        <div className={cn('flex', 'h-full', 'min-h-[2.5rem]', 'min-w-0', 'items-center')}>
          <div
            className={cn(
              uiTypographyRecipes.cardTitle,
              uiTextRecipes.primary,
              'min-w-0',
              'line-clamp-2',
              'break-words'
            )}
          >
            {merchant.name}
          </div>
        </div>
        <div className={cn('flex', 'h-full', 'min-h-[2.5rem]', 'items-center', 'justify-end')}>
          <div
            className={cn(
              uiTypographyRecipes.cardTitle,
              uiTextRecipes.primary,
              'min-w-0',
              'max-w-[8rem]',
              'line-clamp-2',
              'break-words',
              'text-right',
              'tabular-nums'
            )}
          >
            {fmtUSD(merchant.amount)}
          </div>
        </div>
        <div
          className={cn(
            'flex',
            'shrink-0',
            'flex-col',
            'items-end',
            'justify-center',
            'gap-0.5',
            'self-center',
            'text-right'
          )}
        >
          <div className={cn(uiTypographyRecipes.caption, uiTextRecipes.muted, 'tabular-nums')}>
            {merchant.percentage}%
          </div>
          <div
            className={cn(uiTypographyRecipes.captionStrong, uiTextRecipes.muted, 'tabular-nums')}
          >
            {merchant.count}
            <span className={cn(uiTypographyRecipes.caption, uiTextRecipes.body, 'ml-0.5')}>
              tx
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const TopMerchantsListFn: React.FC<Props> = ({ merchants, className = '' }) => {
  const merchantsToShow = merchants.slice(0, 8);

  return (
    <div className={cn('h-full', 'flex', 'flex-col', className)}>
      <ChartFadePresence
        stateKey={merchantsToShow.length > 0 ? 'chart' : 'empty'}
        className={cn('h-full')}
      >
        {merchantsToShow.length > 0 ? (
          <div
            className={cn(
              'grid',
              'grid-cols-1',
              'md:grid-cols-2',
              'gap-[length:var(--spacing-compact-gap)]'
            )}
          >
            {merchantsToShow.map((merchant) => (
              <MerchantCard key={merchant.name} merchant={merchant} />
            ))}
          </div>
        ) : (
          <div className={cn('flex', 'items-center', 'justify-center', 'flex-1')}>
            <EmptyState
              icon={MapPin}
              title="No merchants ranked yet"
              description="No merchants recorded for this period."
            />
          </div>
        )}
      </ChartFadePresence>
    </div>
  );
};
export const TopMerchantsList = React.memo(TopMerchantsListFn);
export default TopMerchantsList;
