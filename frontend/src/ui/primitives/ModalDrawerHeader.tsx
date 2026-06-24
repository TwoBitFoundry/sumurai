import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type React from 'react';
import { brandNeutral } from '@/ui/recipes';
import { Button } from './Button';
import { cn } from './utils';

export interface ModalDrawerHeaderProps {
  children: React.ReactNode;
  onClose: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
  closeWithDialog?: boolean;
}

export function ModalDrawerHeader({
  children,
  onClose,
  closeLabel = 'Close',
  closeDisabled = false,
  closeWithDialog = false,
}: ModalDrawerHeaderProps) {
  const closeButton = (
    <Button
      type="button"
      variant="secondary"
      shape="square"
      size="sm"
      aria-label={closeLabel}
      title="Close"
      disabled={closeDisabled}
      onClick={closeWithDialog ? undefined : onClose}
      className={cn('shrink-0')}
    >
      <X aria-hidden="true" />
    </Button>
  );

  return (
    <div className={cn('flex min-w-0 items-center justify-between gap-3')}>
      <div className={cn('min-w-0 flex-1')}>{children}</div>
      {closeWithDialog ? <Dialog.Close asChild>{closeButton}</Dialog.Close> : closeButton}
    </div>
  );
}

export const modalDrawerSectionLabelClassName = cn(
  'text-sm font-semibold uppercase tracking-[0.18em]',
  brandNeutral.textSubtle
);

export default ModalDrawerHeader;
