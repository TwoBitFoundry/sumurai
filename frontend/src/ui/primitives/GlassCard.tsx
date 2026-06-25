import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import {
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
  radius as uiRadiusRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

export const glassCardRecipes = {
  base: [
    'relative overflow-hidden',
    'border',
    ...semanticEffects.glassBackdrop,
    'transition-colors duration-500',
  ],
  elevated: [...semanticEffects.glassElevationShadow],
  default: [...semanticBorders.glass, ...semanticSurfaces.glassPanel],
  auth: [
    ...semanticBorders.glass,
    ...semanticSurfaces.glassPanel,
    ...semanticEffects.glassBackdrop,
  ],
  accent: [...semanticBorders.elevatedGlass, ...semanticSurfaces.glassPanel],
  danger: ['border-red-200/70', 'bg-red-50/80', 'dark:border-red-700/60', 'dark:bg-red-900/25'],
  rounded: {
    default: uiRadiusRecipes.standard,
    lg: uiRadiusRecipes.standard,
    xl: uiRadiusRecipes.standard,
  },
  padding: {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  },
} as const;

const glassCardVariants = cva([...glassCardRecipes.base], {
  variants: {
    elevated: {
      true: [...glassCardRecipes.elevated],
      false: [],
    },
    variant: {
      default: [...glassCardRecipes.default],
      auth: [...glassCardRecipes.auth],
      accent: [...glassCardRecipes.accent],
      danger: [...glassCardRecipes.danger],
    },
    rounded: {
      default: glassCardRecipes.rounded.default,
      lg: glassCardRecipes.rounded.lg,
      xl: glassCardRecipes.rounded.xl,
    },
    padding: {
      none: glassCardRecipes.padding.none,
      sm: glassCardRecipes.padding.sm,
      md: glassCardRecipes.padding.md,
      lg: glassCardRecipes.padding.lg,
    },
  },
  defaultVariants: {
    elevated: true,
    variant: 'default',
    rounded: 'default',
    padding: 'md',
  },
});

export interface GlassCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {
  children: React.ReactNode;
  withInnerEffects?: boolean;
  containerClassName?: string;
  beforeContent?: React.ReactNode;
}

/**
 * Container with glassmorphism effect (backdrop blur, semi-transparency, subtle borders).
 *
 * @example
 * ```tsx
 * <GlassCard variant="default" padding="lg">
 *   <h2>Card Title</h2>
 *   <p>Card content...</p>
 * </GlassCard>
 * ```
 *
 * @param withInnerEffects - Enable inner ring and gradient overlay (default: true)
 * @param containerClassName - Applied to outer container
 * @param className - Applied to inner content wrapper
 *
 * @see {@link ../README.md} for detailed variant documentation
 */
export function GlassCard({
  children,
  variant,
  rounded,
  padding,
  elevated,
  withInnerEffects = true,
  className,
  containerClassName,
  beforeContent,
  ref,
  ...props
}: GlassCardProps & { ref?: React.RefObject<HTMLDivElement | null> }) {
  const roundedClass = uiRadiusRecipes.standard;

  return (
    <div
      ref={ref}
      className={cn(glassCardVariants({ elevated, variant, rounded, padding }), containerClassName)}
      {...props}
    >
      {withInnerEffects && (
        <div className={cn('pointer-events-none', 'absolute', 'inset-0')}>
          <div
            className={cn(
              'absolute inset-0',
              roundedClass,
              'ring-inset ring-1',
              'ring-white/40',
              'dark:ring-white/10'
            )}
          />
        </div>
      )}
      {beforeContent}
      <div className={cn('relative z-10', padding === 'none' ? '' : '', className)}>{children}</div>
    </div>
  );
}

export default GlassCard;
