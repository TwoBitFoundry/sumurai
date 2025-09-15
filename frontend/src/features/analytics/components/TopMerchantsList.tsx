import React from 'react'
import type { AnalyticsTopMerchantsResponse } from '../../../types/api'
import { fmtUSD } from '../../../utils/format'

type Props = { merchants: AnalyticsTopMerchantsResponse[] }

export const TopMerchantsList: React.FC<Props> = ({ merchants }) => {
  return (
    <div className="space-y-3">
      {merchants.length > 0 ? (
        merchants.map((merchant, index) => (
          <div key={merchant.name + index} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-900 text-xs font-bold">
                {index + 1}
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{merchant.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {merchant.count} transaction{merchant.count !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fmtUSD(merchant.amount)}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{merchant.percentage}%</div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <div className="text-sm">No merchants found for this period</div>
        </div>
      )}
    </div>
  )
}

export default TopMerchantsList

