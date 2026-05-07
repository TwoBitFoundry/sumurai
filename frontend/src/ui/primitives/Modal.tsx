import * as Dialog from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from './utils';

const contentVariants = cva('relative w-full', {
  variants: {
    size: {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-2xl',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface ModalProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Dialog.Content>, 'children'>,
    VariantProps<typeof contentVariants> {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  description?: string;
  preventCloseOnBackdrop?: boolean;
  backdropClassName?: string;
  containerClassName?: string;
}

export function Modal({
  isOpen,
  onClose,
  children,
  size,
  labelledBy,
  description,
  preventCloseOnBackdrop,
  className,
  backdropClassName,
  containerClassName,
  ...props
}: ModalProps) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}
    >
      <Dialog.Portal>
        <div className={cn('fixed inset-0 z-50', containerClassName)}>
          <Dialog.Overlay
            data-testid="modal-backdrop"
            className={cn('absolute inset-0 bg-slate-900/70 backdrop-blur-sm', backdropClassName)}
            onPointerDown={(event) => {
              if (preventCloseOnBackdrop) {
                event.preventDefault();
              }
            }}
          />
          <div className={cn('grid', 'h-full', 'place-items-center', 'p-4')}>
            <Dialog.Content
              aria-labelledby={labelledBy}
              aria-describedby={description}
              className={cn(contentVariants({ size }), className)}
              onPointerDownOutside={(event) => {
                if (preventCloseOnBackdrop) {
                  event.preventDefault();
                }
              }}
              {...props}
            >
              {labelledBy ? <Dialog.Title className="sr-only" aria-hidden="true" /> : null}
              {description ? <Dialog.Description className="sr-only" aria-hidden="true" /> : null}
              {children}
            </Dialog.Content>
          </div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default Modal;
