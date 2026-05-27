import * as Popover from '@radix-ui/react-popover';
import { Info } from 'lucide-react';
import { useId, useState } from 'react';
import { Button, cn, IconButton, Modal } from '@/ui/primitives';
import {
  chromeBar,
  controlIconWell,
  border as uiBorderRecipes,
  status as uiStatusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import type { ProviderCardSection } from '@/utils/providerCards';

interface ProviderSelectionSectionProps {
  section: ProviderCardSection;
  isMobile: boolean;
}

export const ProviderSelectionSection = ({ section, isMobile }: ProviderSelectionSectionProps) => {
  const SectionIcon = section.icon;
  const privacyInfoDetails = section.label === 'Privacy' ? (section.privacyDetails ?? []) : [];
  const [isPrivacyDetailsOpen, setIsPrivacyDetailsOpen] = useState(false);
  const privacyDescriptionId = useId();
  const privacyDetailsTriggerClasses = cn(
    'shrink-0',
    'rounded-full',
    ...chromeBar.glyphWell,
    ...uiSurfaceRecipes.card,
    ...uiBorderRecipes.subtle,
    uiTextRecipes.accent,
    'hover:text-[var(--color-text-primary)]',
    'dark:hover:text-[var(--color-text-primary)]'
  );

  const privacyDetailsList = (
    <div className={cn('space-y-3')}>
      {privacyInfoDetails.map((detail) => (
        <div key={detail.label} className={cn('space-y-1')}>
          <div className={cn(uiTypographyRecipes.label, uiTextRecipes.primary)}>{detail.label}</div>
          <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.subtle)}>{detail.value}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={cn(
        'grid',
        'grid-cols-[1.5rem_4.5rem_minmax(0,1fr)]',
        'items-center',
        'gap-x-2',
        'rounded-2xl',
        'border',
        ...uiBorderRecipes.subtle,
        ...uiSurfaceRecipes.insetWell,
        'p-2.5',
        'md:p-3'
      )}
    >
      <span className={cn('col-start-1', ...controlIconWell.md, ...uiStatusRecipes.info.icon)}>
        <SectionIcon aria-hidden />
      </span>
      <div
        className={cn(
          'col-start-2',
          'min-w-0',
          'w-full',
          'whitespace-nowrap',
          uiTypographyRecipes.bodyStrong,
          uiTextRecipes.primary
        )}
      >
        {section.label}
      </div>
      <div
        className={cn(
          'col-start-3',
          'min-w-0',
          'flex',
          'items-center',
          'w-full',
          'justify-between',
          'gap-1.5',
          uiTypographyRecipes.bodyStrong,
          uiTextRecipes.primary
        )}
      >
        {section.value}
        {privacyInfoDetails.length > 0 ? (
          isMobile ? (
            <>
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                aria-haspopup="dialog"
                aria-expanded={isPrivacyDetailsOpen}
                aria-controls={privacyDescriptionId}
                aria-label={`Show privacy details for ${section.value}`}
                onClick={() => {
                  setIsPrivacyDetailsOpen(true);
                }}
                className={privacyDetailsTriggerClasses}
              >
                <Info className={cn(chromeBar.glyph)} aria-hidden />
              </IconButton>
              <Modal
                isOpen={isPrivacyDetailsOpen}
                onClose={() => {
                  setIsPrivacyDetailsOpen(false);
                }}
                presentation="centered"
                size="sm"
                description={privacyDescriptionId}
                aria-label="Privacy details"
                className={cn(
                  'overflow-hidden',
                  'rounded-[1.75rem]',
                  'border',
                  ...uiBorderRecipes.glass,
                  ...uiSurfaceRecipes.glassPanel,
                  'shadow-[0_24px_70px_-36px_rgba(15,23,42,0.55)]',
                  'backdrop-blur-2xl'
                )}
              >
                <div id={privacyDescriptionId} className={cn('space-y-4', 'p-5')}>
                  {privacyDetailsList}
                  <div className={cn('flex', 'justify-end')}>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setIsPrivacyDetailsOpen(false);
                      }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </Modal>
            </>
          ) : (
            <Popover.Root>
              <Popover.Trigger asChild>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Show privacy details for ${section.value}`}
                  className={privacyDetailsTriggerClasses}
                >
                  <Info className={cn(chromeBar.glyph)} aria-hidden />
                </IconButton>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  side="top"
                  align="end"
                  sideOffset={10}
                  collisionPadding={12}
                  className={cn(
                    'z-50',
                    'w-[min(18rem,calc(100vw-1rem))]',
                    'max-w-[18rem]',
                    'rounded-2xl',
                    'border',
                    ...uiBorderRecipes.glass,
                    ...uiSurfaceRecipes.glassPanel,
                    'p-3.5',
                    'shadow-[0_24px_70px_-36px_rgba(15,23,42,0.55)]',
                    'backdrop-blur-2xl',
                    'text-left'
                  )}
                >
                  <div className={cn('mt-3')}>{privacyDetailsList}</div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )
        ) : null}
      </div>
    </div>
  );
};

export default ProviderSelectionSection;
