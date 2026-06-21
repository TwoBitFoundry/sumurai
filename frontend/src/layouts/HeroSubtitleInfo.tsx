import * as Popover from '@radix-ui/react-popover';
import { Info } from 'lucide-react';
import { ControlHoverLabel, cn } from '@/ui/primitives';
import {
  heroInfoTriggerButton,
  infoPopoverShell,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

interface HeroSubtitleInfoProps {
  pageTitle: string;
  subtitle: string;
}

const heroSubtitleInfoHoverLabel = 'About';

export function HeroSubtitleInfo({ pageTitle, subtitle }: HeroSubtitleInfoProps) {
  return (
    <Popover.Root>
      <ControlHoverLabel label={heroSubtitleInfoHoverLabel}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={`${heroSubtitleInfoHoverLabel} ${pageTitle}`}
            className={cn(...heroInfoTriggerButton)}
          >
            <Info aria-hidden />
          </button>
        </Popover.Trigger>
      </ControlHoverLabel>
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
