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
  merchantLineClassName?: string;
  metaContent?: React.ReactNode;
  onMerchantActivate?: () => void;
  layeredSearchTarget?: boolean;
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

function MerchantInteractiveLine({
  normalizedMerchant,
  showPopover,
  rawMerchant,
  onMerchantActivate,
  className,
  layeredSearchTarget = false,
}: {
  normalizedMerchant: string;
  showPopover: boolean;
  rawMerchant?: string;
  onMerchantActivate?: () => void;
  className?: string;
  layeredSearchTarget?: boolean;
}) {
  const lineClassName = cn(
    'block',
    'w-fit',
    'max-w-full',
    'rounded-md',
    'bg-transparent',
    'text-left',
    'transition-colors',
    'duration-150',
    'touch-manipulation',
    uiFocusRecipes.visible,
    layeredSearchTarget && 'relative z-10 pointer-events-auto',
    className
  );

  if (showPopover) {
    return (
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`Show raw merchant for ${normalizedMerchant}`}
            onClick={(event) => event.stopPropagation()}
            className={cn(
              lineClassName,
              'cursor-pointer',
              'hover:text-emerald-600',
              'dark:hover:text-emerald-300'
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
  }

  if (onMerchantActivate) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onMerchantActivate();
        }}
        className={cn(lineClassName, 'cursor-pointer')}
      >
        {normalizedMerchant}
      </button>
    );
  }

  return (
    <span className={cn(className, layeredSearchTarget && 'pointer-events-none')}>
      {normalizedMerchant}
    </span>
  );
}

export const TransactionMerchantLabel: React.FC<Props> = ({
  merchantName,
  originalMerchantName,
  className,
  merchantLineClassName,
  metaContent,
  onMerchantActivate,
  layeredSearchTarget = false,
}) => {
  const normalizedMerchant = merchantName || '-';
  const rawMerchant = originalMerchantName?.trim();
  const showPopover = Boolean(rawMerchant && rawMerchant !== normalizedMerchant);
  const useMobileLayout = metaContent !== undefined || onMerchantActivate !== undefined;

  if (useMobileLayout) {
    return (
      <div className={cn(transactionsRowRecipes.mainSurfaceHost)}>
        <MerchantInteractiveLine
          normalizedMerchant={normalizedMerchant}
          showPopover={showPopover}
          rawMerchant={rawMerchant}
          onMerchantActivate={onMerchantActivate}
          className={merchantLineClassName}
          layeredSearchTarget={layeredSearchTarget}
        />
        {metaContent}
      </div>
    );
  }

  if (!showPopover) {
    return (
      <span className={cn(className, layeredSearchTarget && 'pointer-events-none')}>
        {normalizedMerchant}
      </span>
    );
  }

  return (
    <MerchantInteractiveLine
      normalizedMerchant={normalizedMerchant}
      showPopover={showPopover}
      rawMerchant={rawMerchant}
      className={className}
      layeredSearchTarget={layeredSearchTarget}
    />
  );
};

export default TransactionMerchantLabel;
