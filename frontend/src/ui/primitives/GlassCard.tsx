import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { designTokens } from '@/ui/tokens';
import { primitiveTokenRecipes } from './recipes';
import { cn } from './utils';

const glassCardVariants = cva([...primitiveTokenRecipes.glassCard.base], {
  variants: {
    variant: {
      default: [...primitiveTokenRecipes.glassCard.default],
      auth: [...primitiveTokenRecipes.glassCard.auth],
      accent: [...primitiveTokenRecipes.glassCard.accent],
    },
    rounded: {
      default: primitiveTokenRecipes.glassCard.rounded.default,
      lg: primitiveTokenRecipes.glassCard.rounded.lg,
      xl: primitiveTokenRecipes.glassCard.rounded.xl,
    },
    padding: {
      none: primitiveTokenRecipes.glassCard.padding.none,
      sm: primitiveTokenRecipes.glassCard.padding.sm,
      md: primitiveTokenRecipes.glassCard.padding.md,
      lg: primitiveTokenRecipes.glassCard.padding.lg,
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
  const roundedClass =
    rounded === 'default' ? 'rounded-[2.25rem]' : rounded === 'lg' ? 'rounded-2xl' : 'rounded-3xl';

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
              designTokens.shadows.glassInset.light,
              'dark:ring-white/10',
              designTokens.shadows.glassInset.dark
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
