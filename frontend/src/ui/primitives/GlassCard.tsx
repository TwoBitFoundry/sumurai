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
    ...semanticEffects.glassShadow,
    'backdrop-blur-2xl backdrop-saturate-[150%]',
    'transition-colors duration-500',
    'dark:shadow-[0_42px_140px_-80px_var(--color-effect-glass-shadow)]',
  ],
  default: [...semanticBorders.glass, ...semanticSurfaces.glassPanel],
  auth: [
    ...semanticBorders.glass,
    ...semanticSurfaces.glassPanel,
    'shadow-[0_38px_120px_-60px_var(--color-effect-glass-shadow)]',
    'backdrop-blur-[26px]',
    'backdrop-saturate-[140%]',
    'dark:shadow-[0_40px_120px_-58px_var(--color-effect-glass-shadow)]',
  ],
  accent: [
    ...semanticBorders.elevatedGlass,
    'bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_36%,transparent)]',
    'dark:bg-[color:color-mix(in_srgb,var(--color-surface-glass-panel)_55%,transparent)]',
  ],
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

const glassInsetLight =
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)]';
const glassInsetDark =
  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.5)]';

const glassCardVariants = cva([...glassCardRecipes.base], {
  variants: {
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
  withInnerEffects = true,
  className,
  containerClassName,
  beforeContent,
  ...props
}: GlassCardProps) {
  const roundedClass = uiRadiusRecipes.standard;

  return (
    <div
      className={cn(glassCardVariants({ variant, rounded, padding }), containerClassName)}
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
              glassInsetLight,
              'dark:ring-white/10',
              glassInsetDark
            )}
          />
          <div
            className={cn(
              'absolute inset-0',
              roundedClass,
              'bg-gradient-to-b',
              'from-white/65 via-white/25 to-transparent',
              'transition-colors duration-500',
              'dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent'
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
