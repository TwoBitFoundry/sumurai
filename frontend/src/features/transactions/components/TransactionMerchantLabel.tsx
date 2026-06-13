import * as Popover from '@radix-ui/react-popover';
import type React from 'react';
import { cn } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  effect as uiEffectRecipes,
  focus as uiFocusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { transactionsRowRecipes } from './transactionsRowRecipes';

interface Props {
  merchantName?: string;
  originalMerchantName?: string;
  className?: string;
  surfaceContent?: React.ReactNode;
}

function RawMerchantPopoverContent({ rawMerchant }: { rawMerchant: string }) {
  return (
    <Popover.Content
      side="top"
      align="start"
      sideOffset={10}
      collisionPadding={12}
      className={cn(
        'z-50',
        'w-[min(20rem,calc(100vw-1rem))]',
        'max-w-[20rem]',
        'rounded-lg',
        'border',
        ...uiBorderRecipes.glass,
        ...uiSurfaceRecipes.glassPanel,
        ...uiEffectRecipes.glassDropShadow,
        'p-3',
        ...uiEffectRecipes.glassBackdrop
      )}
    >
      <div className={cn('space-y-1.5')}>
        <p className={cn(uiTypographyRecipes.label, uiTextRecipes.muted)}>Raw merchant</p>
        <p className={cn(uiTypographyRecipes.body, uiTextRecipes.primary, 'break-words')}>
          {rawMerchant}
        </p>
      </div>
    </Popover.Content>
  );
}

export const TransactionMerchantLabel: React.FC<Props> = ({
  merchantName,
  originalMerchantName,
  className,
  surfaceContent,
}) => {
  const normalizedMerchant = merchantName || '-';
  const rawMerchant = originalMerchantName?.trim();
  const showPopover = Boolean(rawMerchant && rawMerchant !== normalizedMerchant);

  if (surfaceContent) {
    const overlayClassName = cn(transactionsRowRecipes.mainSurface, className);

    return (
      <div className={cn(transactionsRowRecipes.mainSurfaceHost)}>
        <div className={cn(transactionsRowRecipes.mainSurfaceContent)}>{surfaceContent}</div>
        {showPopover ? (
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                aria-label={`Show raw merchant for ${normalizedMerchant}`}
                className={cn(
                  overlayClassName,
                  'cursor-pointer',
                  'touch-manipulation',
                  uiFocusRecipes.visible
                )}
              />
            </Popover.Trigger>
            <Popover.Portal>
              <RawMerchantPopoverContent rawMerchant={rawMerchant ?? ''} />
            </Popover.Portal>
          </Popover.Root>
        ) : (
          <div className={cn(overlayClassName, 'pointer-events-none')} aria-hidden="true" />
        )}
      </div>
    );
  }

  if (!showPopover) {
    return <span className={className}>{normalizedMerchant}</span>;
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Show raw merchant for ${normalizedMerchant}`}
          className={cn(
            'w-full',
            'rounded-md',
            'bg-transparent',
            'text-left',
            'transition-colors',
            'duration-150',
            'hover:text-emerald-600',
            'dark:hover:text-emerald-300',
            uiFocusRecipes.visible,
            className
          )}
        >
          {normalizedMerchant}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <RawMerchantPopoverContent rawMerchant={rawMerchant ?? ''} />
      </Popover.Portal>
    </Popover.Root>
  );
};

export default TransactionMerchantLabel;
