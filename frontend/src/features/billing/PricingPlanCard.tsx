import { Check, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { GlassCard } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import {
  chromeBar,
  controlIconWell,
  providerNestedCard,
  providerSelectionCard,
  border as uiBorderRecipes,
  radius as uiRadiusRecipes,
  status as uiStatusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';

interface PricingPlanCardProps {
  meta: string;
  title: string;
  detail: string;
  icon: LucideIcon;
  features: string[];
  children: ReactNode;
}

export function PricingPlanCard({
  meta,
  title,
  detail,
  icon: Icon,
  features,
  children,
}: PricingPlanCardProps) {
  return (
    <GlassCard
      variant="accent"
      rounded="lg"
      padding="none"
      withInnerEffects={false}
      containerClassName={cn(
        'h-full',
        'w-full',
        ...providerSelectionCard.shell,
        ...providerSelectionCard.padding
      )}
    >
      <div className={cn('flex', 'h-full', 'flex-col', 'gap-5')}>
        <div
          className={cn(
            'grid',
            'grid-cols-[auto_minmax(0,1fr)]',
            'grid-rows-[auto_auto]',
            'items-start',
            'gap-x-3',
            'gap-y-1'
          )}
        >
          <span
            className={cn(
              'row-span-2',
              chromeBar.square,
              'inline-flex',
              'shrink-0',
              'items-center',
              'justify-center',
              'self-center',
              'rounded-full',
              ...uiBorderRecipes.subtle,
              ...uiSurfaceRecipes.insetWell,
              ...uiStatusRecipes.info.icon
            )}
            aria-hidden
          >
            <Icon className={cn(chromeBar.glyph)} />
          </span>
          <h2
            className={cn(
              'col-start-2',
              'row-start-1',
              uiTypographyRecipes.cardTitle,
              uiTextRecipes.primary
            )}
          >
            {title}
          </h2>
          <p
            className={cn(
              'col-start-2',
              'row-start-2',
              uiTypographyRecipes.caption,
              uiTextRecipes.subtle
            )}
          >
            {meta}
          </p>
        </div>

        <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body)}>{detail}</p>

        <div className={cn('space-y-3')}>
          {features.map((feature) => (
            <div
              key={feature}
              className={cn(
                'grid',
                'grid-cols-[1.5rem_minmax(0,1fr)]',
                'items-center',
                'gap-x-2',
                uiRadiusRecipes.standard,
                'border',
                'text-left',
                'transition-all',
                'duration-300',
                ...uiBorderRecipes.subtle,
                ...uiSurfaceRecipes.solidCard,
                'p-2.5',
                'md:p-3'
              )}
            >
              <Check
                aria-hidden
                className={cn(...controlIconWell.md, ...uiStatusRecipes.success.icon)}
              />
              <span
                className={cn('min-w-0', uiTypographyRecipes.bodyStrong, providerNestedCard.label)}
              >
                {feature}
              </span>
            </div>
          ))}
        </div>

        <div className={cn('mt-auto', 'flex', 'w-full', 'flex-col', 'items-center', 'gap-3')}>
          {children}
        </div>
      </div>
    </GlassCard>
  );
}
