import { Info } from 'lucide-react';
import { cn } from '@/ui/primitives';
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
}

export const ProviderSelectionSection = ({ section }: ProviderSelectionSectionProps) => {
  const SectionIcon = section.icon;
  const privacyInfoLabel = section.label === 'Privacy' ? section.description : null;

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
        {privacyInfoLabel ? (
          <span
            title={privacyInfoLabel}
            className={cn(
              ...chromeBar.glyphWell,
              'rounded-full',
              ...uiSurfaceRecipes.card,
              ...uiBorderRecipes.subtle,
              uiTextRecipes.accent,
              'shrink-0'
            )}
          >
            <Info className={cn(chromeBar.glyph)} aria-hidden />
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default ProviderSelectionSection;
