import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type React from 'react';
import { cn } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';

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
      className: `bg-emerald-500/15 ${designTokens.text.success} ring-1 ring-emerald-500/20`,
      Icon: CheckCircle2,
    },
    needs_reauth: {
      label: 'Re-auth needed',
      className: `bg-amber-500/15 ${designTokens.text.warning} ring-1 ring-amber-500/20`,
      Icon: AlertTriangle,
    },
    error: {
      label: 'Error',
      className: `bg-rose-500/15 ${designTokens.text.danger} ring-1 ring-rose-500/20`,
      Icon: AlertTriangle,
    },
  } as const;

  const { label, className: statusClassName, Icon } = statusConfig[status];

  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full',
        designTokens.typography.label,
        statusClassName,
        className
      )}
    >
      <Icon className={cn('h-3.5', 'w-3.5')} />
      {label}
    </span>
  );
};
