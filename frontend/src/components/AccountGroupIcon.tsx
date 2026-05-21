import { CreditCard, HandCoins, LineChart, type LucideIcon, PiggyBank } from 'lucide-react';
import { ACCOUNT_GROUP_ACCENT, type AccountGroupKey } from '../domain/accountCategories';
import { cn } from '../ui/primitives';
import { heroAccents } from '../ui/tokens';

const ACCOUNT_GROUP_ICON_MAP: Record<AccountGroupKey, LucideIcon> = {
  cash: PiggyBank,
  credit: CreditCard,
  investments: LineChart,
  loans: HandCoins,
};

type AccountGroupIconProps = {
  group: AccountGroupKey;
  className?: string;
};

export function AccountGroupIcon({ group, className }: AccountGroupIconProps) {
  const Icon = ACCOUNT_GROUP_ICON_MAP[group];
  const iconColorClass = heroAccents[ACCOUNT_GROUP_ACCENT[group]].icon;
  return <Icon className={cn('shrink-0', iconColorClass, className)} aria-hidden />;
}
