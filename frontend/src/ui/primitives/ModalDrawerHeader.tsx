import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type React from 'react';
import { IconButton } from './IconButton';
import { cn } from './utils';

export interface ModalDrawerHeaderProps {
  children: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
  closeWithDialog?: boolean;
}

export function ModalDrawerHeader({
  children,
  onClose,
  closeLabel = 'Close',
  closeWithDialog = false,
}: ModalDrawerHeaderProps) {
  const closeButton = (
    <IconButton
      type="button"
      variant="ghost"
      size="sm"
      aria-label={closeLabel}
      onClick={closeWithDialog ? undefined : onClose}
      className={cn('shrink-0', '-mr-1')}
    >
      <X aria-hidden="true" />
    </IconButton>
  );

  return (
    <div className={cn('flex items-center justify-between gap-3')}>
      <div className={cn('min-w-0 flex-1')}>{children}</div>
      {closeWithDialog ? <Dialog.Close asChild>{closeButton}</Dialog.Close> : closeButton}
    </div>
  );
}

export const modalDrawerSectionLabelClassName = cn(
  'text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400'
);

export default ModalDrawerHeader;
