import React from 'react'
import type { AnalyticsTopMerchantsResponse } from '../../../types/api'
import { fmtUSD } from '../../../utils/format'
import { MapPin } from 'lucide-react'
import { cn, EmptyState } from '@/ui/primitives'

type Props = {
  merchants: AnalyticsTopMerchantsResponse[]
  className?: string
}

export const TopMerchantsList: React.FC<Props> = ({ merchants, className = '' }) => {
  const merchantsToShow = merchants.slice(0, 6)

  return (
    <div className={cn('h-full', 'flex', 'flex-col', className)}>
      {merchantsToShow.length > 0 ? (
        <div className={cn('space-y-3')}>
          {merchantsToShow.map((merchant, index) => (
            <div
              key={merchant.name + index}
              className={cn('flex', 'items-center', 'justify-between', 'p-3', 'rounded-lg', 'border', 'border-slate-200', 'dark:border-slate-700', 'bg-slate-50', 'dark:bg-slate-800/50', 'transition-all', 'duration-300', 'hover:border-[#93c5fd]', 'dark:hover:border-[#38bdf8]', 'hover:-translate-y-[2px]')}
            >
              <div className={cn('flex', 'items-center', 'gap-3', 'min-w-0', 'flex-1')}>
                <div className={cn('flex', 'items-center', 'justify-center', 'w-6', 'h-6', 'rounded-full', 'bg-gradient-to-r', 'from-cyan-400', 'to-emerald-400', 'text-slate-900', 'text-xs', 'font-bold', 'flex-shrink-0')}>
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className={cn('text-sm', 'font-medium', 'text-slate-900', 'dark:text-slate-100', 'truncate')}>{merchant.name}</div>
                  <div className={cn('text-xs', 'text-slate-500', 'dark:text-slate-400')}>
                    {merchant.count} transaction{merchant.count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <div className={cn('text-right', 'flex-shrink-0', 'ml-4')}>
                <div className={cn('text-sm', 'font-semibold', 'text-slate-900', 'dark:text-slate-100')}>{fmtUSD(merchant.amount)}</div>
                <div className={cn('text-xs', 'text-slate-500', 'dark:text-slate-400')}>{merchant.percentage}%</div>
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
  )
}

export default TopMerchantsList