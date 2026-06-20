import * as Popover from '@radix-ui/react-popover';
import { Check, Info, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Button, ControlHoverLabel, cn, Modal } from '@/ui/primitives';
import {
  controlIconWell,
  inlineInfoTriggerButton,
  border as uiBorderRecipes,
  effect as uiEffectRecipes,
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

const privacyInfoHoverLabel = 'Privacy details';

export const ProviderSelectionSection = ({ section, isMobile }: ProviderSelectionSectionProps) => {
  const SectionIcon = section.icon;
  const privacyInfoDetails = section.label === 'Privacy' ? (section.privacyDetails ?? []) : [];
  const [isPrivacyDetailsOpen, setIsPrivacyDetailsOpen] = useState(false);
  const privacyDescriptionId = useId();

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
        <span className={cn('flex', 'items-center', 'gap-1')}>
          {section.synced === true ? (
            <Check
              aria-hidden
              className={cn('h-3.5', 'w-3.5', 'shrink-0', ...uiStatusRecipes.success.text)}
            />
          ) : section.synced === false ? (
            <X
              aria-hidden
              className={cn('h-3.5', 'w-3.5', 'shrink-0', ...uiStatusRecipes.danger.text)}
            />
          ) : null}
          {section.value}
        </span>
        {privacyInfoDetails.length > 0 ? (
          isMobile ? (
            <>
              <ControlHoverLabel label={privacyInfoHoverLabel}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={isPrivacyDetailsOpen}
                  aria-controls={privacyDescriptionId}
                  aria-label={`${privacyInfoHoverLabel} for ${section.label}`}
                  onClick={() => {
                    setIsPrivacyDetailsOpen(true);
                  }}
                  className={cn(...inlineInfoTriggerButton)}
                >
                  <Info aria-hidden />
                </button>
              </ControlHoverLabel>
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
                  ...uiEffectRecipes.glassDropShadow,
                  ...uiEffectRecipes.glassBackdrop
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
              <ControlHoverLabel label={privacyInfoHoverLabel}>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    aria-label={`${privacyInfoHoverLabel} for ${section.label}`}
                    className={cn(...inlineInfoTriggerButton)}
                  >
                    <Info aria-hidden />
                  </button>
                </Popover.Trigger>
              </ControlHoverLabel>
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
                    ...uiEffectRecipes.glassDropShadow,
                    ...uiEffectRecipes.glassBackdrop,
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
