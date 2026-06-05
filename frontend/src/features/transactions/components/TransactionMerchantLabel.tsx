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

interface Props {
  merchantName?: string;
  originalMerchantName?: string;
  className?: string;
}

export const TransactionMerchantLabel: React.FC<Props> = ({
  merchantName,
  originalMerchantName,
  className,
}) => {
  const normalizedMerchant = merchantName || '-';
  const rawMerchant = originalMerchantName?.trim();
  const showPopover = Boolean(rawMerchant && rawMerchant !== normalizedMerchant);

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
            'hover:text-sky-600',
            'dark:hover:text-sky-300',
            uiFocusRecipes.visible,
            className
          )}
        >
          {normalizedMerchant}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
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
            ...uiEffectRecipes.glassShadow,
            'p-3',
            'backdrop-blur-2xl',
            'backdrop-saturate-[150%]'
          )}
        >
          <div className={cn('space-y-1.5')}>
            <p className={cn(uiTypographyRecipes.label, uiTextRecipes.muted)}>Raw merchant</p>
            <p className={cn(uiTypographyRecipes.body, uiTextRecipes.primary, 'break-words')}>
              {rawMerchant}
            </p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default TransactionMerchantLabel;
