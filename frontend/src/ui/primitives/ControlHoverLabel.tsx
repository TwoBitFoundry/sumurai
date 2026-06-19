'use client';

import * as Tooltip from '@radix-ui/react-tooltip';
import type { ReactElement, ReactNode } from 'react';
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

export function ControlHoverLabel({ label, disabled, children }: ControlHoverLabelProps) {
  const trigger = disabled ? (
    <span className={cn('inline-flex', 'cursor-not-allowed')}>{children}</span>
  ) : (
    children
  );

  return (
    <Tooltip.Root>
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
