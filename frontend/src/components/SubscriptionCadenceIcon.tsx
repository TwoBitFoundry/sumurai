import { Calendar, CalendarCheck, CalendarDays, type LucideIcon } from 'lucide-react';
import {
  SUBSCRIPTION_CADENCE_ACCENT,
  type SubscriptionCadenceKey,
} from '@/domain/subscriptionCadences';
import { cn } from '@/ui/primitives';
import { heroAccents } from '@/ui/tokens';

const SUBSCRIPTION_CADENCE_ICON_MAP: Record<SubscriptionCadenceKey, LucideIcon> = {
  monthly: CalendarDays,
  quarterly: Calendar,
  annual: CalendarCheck,
};

type SubscriptionCadenceIconProps = {
  cadence: SubscriptionCadenceKey;
  className?: string;
};

export function SubscriptionCadenceIcon({ cadence, className }: SubscriptionCadenceIconProps) {
  const Icon = SUBSCRIPTION_CADENCE_ICON_MAP[cadence];
  const iconColorClass = heroAccents[SUBSCRIPTION_CADENCE_ACCENT[cadence]].icon;

  return <Icon className={cn('shrink-0', iconColorClass, className)} aria-hidden />;
}
