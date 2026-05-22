import * as Dialog from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { floatingChromeGlass, modalDrawer, surface as uiSurfaceRecipes } from '@/ui/recipes';
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

export type ModalPresentation = 'centered' | 'drawer';

export interface ModalProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Dialog.Content>, 'children'>,
    VariantProps<typeof contentVariants> {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  description?: string;
  presentation?: ModalPresentation;
  preventCloseOnBackdrop?: boolean;
  backdropClassName?: string;
  containerClassName?: string;
  gridClassName?: string;
}

export function Modal({
  isOpen,
  onClose,
  children,
  size,
  labelledBy,
  description,
  presentation = 'centered',
  preventCloseOnBackdrop,
  className,
  backdropClassName,
  containerClassName,
  gridClassName,
  ...props
}: ModalProps) {
  const isDrawer = presentation === 'drawer';

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
        {isDrawer ? (
          <>
            <Dialog.Overlay
              data-testid="modal-backdrop"
              data-presentation={presentation}
              className={cn(
                'fixed inset-0 z-50',
                ...modalDrawer.overlayMotion,
                ...uiSurfaceRecipes.overlay,
                containerClassName,
                backdropClassName
              )}
              onPointerDown={(event) => {
                if (preventCloseOnBackdrop) {
                  event.preventDefault();
                }
              }}
            />
            <Dialog.Content
              aria-labelledby={labelledBy}
              aria-describedby={description}
              data-presentation={presentation}
              className={cn(
                'fixed bottom-0 left-0 right-0 z-50 w-full outline-none',
                modalDrawer.contentMotion,
                className
              )}
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
          </>
        ) : (
          <div className={cn('fixed inset-0 z-50', containerClassName)}>
            <Dialog.Overlay
              data-testid="modal-backdrop"
              data-presentation={presentation}
              className={cn(
                'absolute inset-0',
                ...floatingChromeGlass.backdrop,
                ...uiSurfaceRecipes.overlay,
                backdropClassName
              )}
              onPointerDown={(event) => {
                if (preventCloseOnBackdrop) {
                  event.preventDefault();
                }
              }}
            />
            <div className={cn('grid h-full place-items-center', gridClassName ?? 'p-4')}>
              <Dialog.Content
                aria-labelledby={labelledBy}
                aria-describedby={description}
                data-presentation={presentation}
                className={cn('z-50 outline-none', contentVariants({ size }), className)}
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
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default Modal;
