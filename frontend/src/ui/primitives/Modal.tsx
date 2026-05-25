import * as Dialog from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  floatingChromeGlass,
  modalBackdrop,
  modalDrawer,
  surface as uiSurfaceRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

const DRAWER_EXIT_MS = 280;
const CENTERED_EXIT_MS = 220;

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
export type ModalBackdropVariant = 'default' | 'provider';

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
  animateCentered?: boolean;
  backdropVariant?: ModalBackdropVariant;
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
  animateCentered = false,
  backdropVariant = 'default',
  className,
  backdropClassName,
  containerClassName,
  gridClassName,
  ...props
}: ModalProps) {
  const isDrawer = presentation === 'drawer';
  const isCenteredAnimated = !isDrawer && animateCentered;
  const centeredBackdropClassName = cn(
    ...(backdropVariant === 'provider'
      ? modalBackdrop.provider
      : [...floatingChromeGlass.backdrop, ...uiSurfaceRecipes.overlay]),
    backdropClassName
  );
  const [drawerOpen, setDrawerOpen] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);
  const [centeredOpen, setCenteredOpen] = useState(isOpen);
  const [isCenteredExiting, setIsCenteredExiting] = useState(false);
  const drawerContentRef = useRef<HTMLDivElement>(null);
  const centeredContentRef = useRef<HTMLDivElement>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centeredExitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExitingRef = useRef(false);
  const isCenteredExitingRef = useRef(false);

  const finishDrawerExit = useCallback(
    (notifyParent: boolean) => {
      isExitingRef.current = false;
      setIsExiting(false);
      setDrawerOpen(false);
      if (notifyParent) {
        onClose?.();
      }
    },
    [onClose]
  );

  const beginDrawerExit = useCallback(
    (notifyParent: boolean) => {
      if (isExitingRef.current) {
        return;
      }
      isExitingRef.current = true;
      setIsExiting(true);

      const node = drawerContentRef.current;
      if (!node) {
        finishDrawerExit(notifyParent);
        return;
      }

      let finished = false;
      const complete = () => {
        if (finished) {
          return;
        }
        finished = true;
        if (exitTimeoutRef.current) {
          clearTimeout(exitTimeoutRef.current);
          exitTimeoutRef.current = null;
        }
        node.removeEventListener('animationend', onAnimationEnd);
        finishDrawerExit(notifyParent);
      };

      const onAnimationEnd = (event: AnimationEvent) => {
        if (event.target !== node) {
          return;
        }
        complete();
      };

      requestAnimationFrame(() => {
        node.addEventListener('animationend', onAnimationEnd);
        exitTimeoutRef.current = setTimeout(complete, DRAWER_EXIT_MS);
      });
    },
    [finishDrawerExit]
  );

  const finishCenteredExit = useCallback(
    (notifyParent: boolean) => {
      isCenteredExitingRef.current = false;
      setIsCenteredExiting(false);
      setCenteredOpen(false);
      if (notifyParent) {
        onClose?.();
      }
    },
    [onClose]
  );

  const beginCenteredExit = useCallback(
    (notifyParent: boolean) => {
      if (isCenteredExitingRef.current) {
        return;
      }
      isCenteredExitingRef.current = true;
      setIsCenteredExiting(true);

      const node = centeredContentRef.current;
      if (!node) {
        finishCenteredExit(notifyParent);
        return;
      }

      let finished = false;
      const complete = () => {
        if (finished) {
          return;
        }
        finished = true;
        if (centeredExitTimeoutRef.current) {
          clearTimeout(centeredExitTimeoutRef.current);
          centeredExitTimeoutRef.current = null;
        }
        node.removeEventListener('animationend', onAnimationEnd);
        finishCenteredExit(notifyParent);
      };

      const onAnimationEnd = (event: AnimationEvent) => {
        if (event.target !== node) {
          return;
        }
        complete();
      };

      requestAnimationFrame(() => {
        node.addEventListener('animationend', onAnimationEnd);
        centeredExitTimeoutRef.current = setTimeout(complete, CENTERED_EXIT_MS);
      });
    },
    [finishCenteredExit]
  );

  useEffect(() => {
    if (isDrawer) {
      if (isOpen) {
        if (exitTimeoutRef.current) {
          clearTimeout(exitTimeoutRef.current);
          exitTimeoutRef.current = null;
        }
        isExitingRef.current = false;
        setIsExiting(false);
        setDrawerOpen(true);
        return;
      }

      if (drawerOpen && !isExitingRef.current) {
        beginDrawerExit(false);
      }
      return;
    }

    if (!isCenteredAnimated) {
      return;
    }

    if (isOpen) {
      if (centeredExitTimeoutRef.current) {
        clearTimeout(centeredExitTimeoutRef.current);
        centeredExitTimeoutRef.current = null;
      }
      isCenteredExitingRef.current = false;
      setIsCenteredExiting(false);
      setCenteredOpen(true);
      return;
    }

    if (centeredOpen && !isCenteredExitingRef.current) {
      beginCenteredExit(false);
    }
  }, [
    beginCenteredExit,
    beginDrawerExit,
    centeredOpen,
    drawerOpen,
    isCenteredAnimated,
    isDrawer,
    isOpen,
  ]);

  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
      }
      if (centeredExitTimeoutRef.current) {
        clearTimeout(centeredExitTimeoutRef.current);
      }
    };
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isDrawer) {
      if (nextOpen) {
        isExitingRef.current = false;
        setIsExiting(false);
        setDrawerOpen(true);
        return;
      }
      beginDrawerExit(true);
      return;
    }

    if (!isCenteredAnimated) {
      if (!nextOpen) {
        onClose?.();
      }
      return;
    }

    if (nextOpen) {
      isCenteredExitingRef.current = false;
      setIsCenteredExiting(false);
      setCenteredOpen(true);
      return;
    }

    onClose?.();
  };

  const rootOpen = isDrawer
    ? drawerOpen || isExiting
    : isCenteredAnimated
      ? centeredOpen || isCenteredExiting
      : isOpen;
  const drawerExitingProps = isExiting ? ({ 'data-exiting': 'true' } as const) : {};
  const centeredExitingProps = isCenteredExiting ? ({ 'data-exiting': 'true' } as const) : {};

  return (
    <Dialog.Root open={rootOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        {isDrawer ? (
          <>
            <Dialog.Overlay
              data-testid="modal-backdrop"
              data-presentation={presentation}
              {...drawerExitingProps}
              className={cn(
                'fixed inset-0 z-50',
                ...modalDrawer.overlayMotion,
                ...modalDrawer.overlay,
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
              ref={drawerContentRef}
              aria-labelledby={labelledBy}
              aria-describedby={description}
              data-presentation={presentation}
              {...drawerExitingProps}
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
              {...(isCenteredAnimated ? centeredExitingProps : {})}
              className={cn(
                isCenteredAnimated && 'modal-centered-overlay',
                'absolute inset-0',
                centeredBackdropClassName
              )}
              onPointerDown={(event) => {
                if (preventCloseOnBackdrop) {
                  event.preventDefault();
                }
              }}
            />
            <div className={cn('grid h-full place-items-center', gridClassName ?? 'p-4')}>
              <Dialog.Content
                ref={isCenteredAnimated ? centeredContentRef : undefined}
                aria-labelledby={labelledBy}
                aria-describedby={description}
                data-presentation={presentation}
                {...(isCenteredAnimated ? centeredExitingProps : {})}
                className={cn(
                  'z-50 outline-none',
                  contentVariants({ size }),
                  isCenteredAnimated && 'modal-centered-content',
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
            </div>
          </div>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default Modal;
