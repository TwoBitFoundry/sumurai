import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type React from 'react';
import { cn } from '@/ui/primitives';
import { status as uiStatusRecipes, font as uiTypographyRecipes } from '@/ui/recipes';

type ConnectionStatus = 'connected' | 'needs_reauth' | 'error';

interface StatusPillProps {
  status: ConnectionStatus;
  className?: string;
}

const classNames = (...classes: (string | false | null | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};

export const StatusPill: React.FC<StatusPillProps> = ({ status, className }) => {
  const statusConfig = {
    connected: {
      label: 'Connected',
      className: `${uiStatusRecipes.success.surface.join(' ')} ${uiStatusRecipes.success.text.join(' ')} ring-1 ring-[var(--color-status-success-border)] dark:ring-[var(--color-status-success-border-dark)]`,
      Icon: CheckCircle2,
    },
    needs_reauth: {
      label: 'Re-auth needed',
      className: `${uiStatusRecipes.warning.surface.join(' ')} ${uiStatusRecipes.warning.text.join(' ')} ring-1 ring-[var(--color-status-warning-border)] dark:ring-[var(--color-status-warning-border-dark)]`,
      Icon: AlertTriangle,
    },
    error: {
      label: 'Error',
      className: `${uiStatusRecipes.danger.surface.join(' ')} ${uiStatusRecipes.danger.text.join(' ')} ring-1 ring-[var(--color-status-danger-border)] dark:ring-[var(--color-status-danger-border-dark)]`,
      Icon: AlertTriangle,
    },
  } as const;

  const { label, className: statusClassName, Icon } = statusConfig[status];

  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full',
        uiTypographyRecipes.label,
        statusClassName,
        className
      )}
    >
      <Icon className={cn('h-3.5', 'w-3.5')} />
      {label}
    </span>
  );
};
