import type { TooltipContentProps } from 'recharts';
import { fmtUSD } from '@/components/Amount';
import { ACCOUNT_GROUP_LABELS } from '@/domain/accountCategories';
import { cn } from '@/ui/primitives';
import {
  status as uiStatusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { ChartTooltipShell } from './ChartGlassTooltip';

export type BalancesBankTooltipDatum = {
  bank: string;
  cash: number | null;
  investments: number | null;
  credit: number | null;
  loan: number | null;
};

export function BalancesBankTooltip({
  active,
  payload,
  label,
}: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) {
    return null;
  }

  const datum = payload[0]?.payload as BalancesBankTooltipDatum | undefined;
  if (!datum) {
    return null;
  }

  const bank = String(label ?? datum.bank);

  return (
    <ChartTooltipShell
      className={cn('flex flex-col gap-2', uiTypographyRecipes.caption, uiTextRecipes.body)}
    >
      <p className={cn(uiTypographyRecipes.captionStrong, uiTextRecipes.primary)}>{bank}</p>
      <div className={cn('grid grid-cols-2 gap-x-4 gap-y-2')}>
        <span className={cn('flex items-center gap-1', uiStatusRecipes.success.text)}>
          <span className={cn('h-2 w-2 shrink-0 rounded-full bg-emerald-500')} />
          {ACCOUNT_GROUP_LABELS.cash}: {fmtUSD(datum.cash ?? 0)}
        </span>
        <span className={cn('flex items-center gap-1', uiStatusRecipes.info.text)}>
          <span className={cn('h-2 w-2 shrink-0 rounded-full bg-cyan-500')} />
          {ACCOUNT_GROUP_LABELS.investments}: {fmtUSD(datum.investments ?? 0)}
        </span>
        <span className={cn('flex items-center gap-1', uiStatusRecipes.danger.text)}>
          <span className={cn('h-2 w-2 shrink-0 rounded-full bg-rose-500')} />
          {ACCOUNT_GROUP_LABELS.credit}: {fmtUSD(datum.credit ?? 0)}
        </span>
        <span className={cn('flex items-center gap-1', uiStatusRecipes.warning.text)}>
          <span className={cn('h-2 w-2 shrink-0 rounded-full bg-amber-500')} />
          {ACCOUNT_GROUP_LABELS.loans}: {fmtUSD(datum.loan ?? 0)}
        </span>
      </div>
    </ChartTooltipShell>
  );
}
