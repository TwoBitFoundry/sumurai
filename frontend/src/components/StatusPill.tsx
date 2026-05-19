import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type React from 'react';
import { cn } from '@/ui/primitives';
import { status as uiStatusRecipes } from '@/ui/recipes';

type ConnectionStatus = 'connected' | 'needs_reauth' | 'error';

interface StatusPillProps {
  status: ConnectionStatus;
  className?: string;
}

export const StatusPill: React.FC<StatusPillProps> = ({ status, className }) => {
  const statusConfig = {
    connected: {
      label: 'Connected',
      iconClass: uiStatusRecipes.success.icon,
      Icon: CheckCircle2,
    },
    needs_reauth: {
      label: 'Re-auth needed',
      iconClass: uiStatusRecipes.warning.icon,
      Icon: AlertTriangle,
    },
    error: {
      label: 'Error',
      iconClass: uiStatusRecipes.danger.icon,
      Icon: AlertTriangle,
    },
  } as const;

  const { label, iconClass, Icon } = statusConfig[status];

  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-flex shrink-0 items-center', iconClass, className)}
    >
      <Icon className={cn('h-4 w-4')} aria-hidden />
    </span>
  );
};
