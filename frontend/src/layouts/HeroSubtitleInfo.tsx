import * as Popover from '@radix-ui/react-popover';
import { Info } from 'lucide-react';
import { cn } from '@/ui/primitives';
import {
  heroSubtitleInfoIconWell,
  infoPopoverShell,
  focus as uiFocusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

interface HeroSubtitleInfoProps {
  pageTitle: string;
  subtitle: string;
}

export function HeroSubtitleInfo({ pageTitle, subtitle }: HeroSubtitleInfoProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Show details for ${pageTitle}`}
          title={`Show details for ${pageTitle}`}
          className={cn(
            'rounded-full',
            'border',
            'border-transparent',
            'bg-transparent',
            uiTextRecipes.muted,
            'transition-colors',
            'duration-150',
            'hover:text-[var(--color-text-primary)]',
            'hover:bg-[var(--color-surface-hover-row)]',
            'dark:hover:text-[var(--color-text-primary)]',
            uiFocusRecipes.visible,
            ...heroSubtitleInfoIconWell
          )}
        >
          <Info aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={infoPopoverShell.sideOffset}
          collisionPadding={infoPopoverShell.collisionPadding}
          className={cn(
            'z-50',
            'w-[min(20rem,calc(100vw-1rem))]',
            'max-w-[20rem]',
            ...infoPopoverShell.shell,
            'p-3'
          )}
        >
          <div className={cn('space-y-1.5')}>
            <p className={cn(uiTypographyRecipes.label, uiTextRecipes.muted)}>About</p>
            <p className={cn(uiTypographyRecipes.body, uiTextRecipes.primary, 'break-words')}>
              {subtitle}
            </p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default HeroSubtitleInfo;
