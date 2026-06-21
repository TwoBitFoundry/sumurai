'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import {
  cloneElement,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useRef,
  useState,
} from 'react';
import { controlHoverLabel, infoPopoverShell } from '@/ui/recipes';
import { cn } from './utils';

export function ControlTooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider
      delayDuration={controlHoverLabel.delayMs}
      skipDelayDuration={0}
      disableHoverableContent
    >
      {children}
    </Tooltip.Provider>
  );
}

interface ControlHoverLabelProps {
  label: string;
  disabled?: boolean;
  children: ReactElement;
}

function childUsesFullWidth(className: unknown): boolean {
  if (typeof className !== 'string') {
    return false;
  }

  return className.split(/\s+/).includes('w-full');
}

function mergeEventHandler<E>(
  existing: ((event: E) => void) | undefined,
  next: (event: E) => void
) {
  return (event: E) => {
    existing?.(event);
    next(event);
  };
}

type TooltipableProps = {
  onMouseEnter?: (event: MouseEvent) => void;
  onMouseLeave?: (event: MouseEvent) => void;
  onPointerDown?: (event: PointerEvent) => void;
  onClick?: (event: MouseEvent) => void;
};

function attachHoverLabelHandlers(
  element: ReactElement,
  handlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onPointerDown: (event: PointerEvent) => void;
    onClick: () => void;
  }
): ReactElement {
  const props = element.props as TooltipableProps;
  const typed = element as ReactElement<TooltipableProps>;

  return cloneElement(typed, {
    onMouseEnter: mergeEventHandler(props.onMouseEnter, handlers.onMouseEnter),
    onMouseLeave: mergeEventHandler(props.onMouseLeave, handlers.onMouseLeave),
    onPointerDown: mergeEventHandler(props.onPointerDown, handlers.onPointerDown),
    onClick: mergeEventHandler(props.onClick, handlers.onClick),
  });
}

export function ControlHoverLabel({ label, disabled, children }: ControlHoverLabelProps) {
  const [open, setOpen] = useState(false);
  const hoveringRef = useRef(false);
  const isFullWidth = childUsesFullWidth((children.props as Record<string, unknown>).className);

  const handlers = {
    onMouseEnter: () => {
      hoveringRef.current = true;
      setOpen(true);
    },
    onMouseLeave: () => {
      hoveringRef.current = false;
      setOpen(false);
    },
    onPointerDown: (_event: PointerEvent) => {
      hoveringRef.current = false;
      setOpen(false);
    },
    onClick: () => {
      hoveringRef.current = false;
      setOpen(false);
    },
  };

  const trigger = disabled
    ? attachHoverLabelHandlers(
        <span
          className={cn(
            'inline-flex',
            isFullWidth && 'w-full',
            isFullWidth && 'justify-center',
            'cursor-not-allowed'
          )}
        >
          {children}
        </span>,
        handlers
      )
    : attachHoverLabelHandlers(children, handlers);

  return (
    <Tooltip.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          if (hoveringRef.current) {
            setOpen(true);
          }
          return;
        }

        if (!hoveringRef.current) {
          setOpen(false);
        }
      }}
    >
      <Tooltip.Trigger asChild>{trigger}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          align="center"
          sideOffset={infoPopoverShell.sideOffset}
          collisionPadding={infoPopoverShell.collisionPadding}
          className={cn(...controlHoverLabel.content)}
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function resolveControlHoverLabel(
  title: string | undefined,
  ariaLabel: string | undefined,
  children: ReactNode
): string | undefined {
  if (title) {
    return title;
  }

  if (typeof ariaLabel === 'string') {
    return ariaLabel;
  }

  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }

  return undefined;
}

const buttonHoverLabelVariants = new Set([
  'primary',
  'secondary',
  'success',
  'connect',
  'danger',
  'tab',
  'tabActive',
]);

export function shouldShowButtonHoverLabel(
  variant: string | null | undefined,
  label: string | undefined
): label is string {
  return Boolean(label && variant && buttonHoverLabelVariants.has(variant));
}
