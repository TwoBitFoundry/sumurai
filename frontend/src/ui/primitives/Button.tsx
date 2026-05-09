import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { designTokens } from '@/ui/tokens';
import { buttonChromeInset, primitiveTokenRecipes } from './recipes';
import { cn } from './utils';

export const buttonTypographySizes = {
  xs: designTokens.typography.label,
  sm: designTokens.typography.captionStrong,
  md: designTokens.typography.captionStrong,
  lg: designTokens.typography.bodyStrong,
} as const;

const buttonVariants = cva([...primitiveTokenRecipes.button.base], {
  variants: {
    variant: {
      primary: [...primitiveTokenRecipes.button.primary],
      secondary: [...primitiveTokenRecipes.button.secondary],
      ghost: [...primitiveTokenRecipes.button.ghost],
      icon: [...primitiveTokenRecipes.button.icon],
      tab: [...primitiveTokenRecipes.button.tab],
      tabActive: [...primitiveTokenRecipes.button.tabActive],
      danger: [...primitiveTokenRecipes.button.danger],
      success: [...primitiveTokenRecipes.button.success],
      connect: [...primitiveTokenRecipes.button.connect],
    },
    size: {
      xs: `${buttonTypographySizes.xs} ${buttonChromeInset.xs}`,
      sm: `${buttonTypographySizes.sm} ${buttonChromeInset.sm}`,
      titleBarExpanded: `${designTokens.typography.titleBarChromeExpanded} ${buttonChromeInset.sm}`,
      md: `${buttonTypographySizes.md} px-4 py-2 rounded-full`,
      lg: `${buttonTypographySizes.lg} px-5 py-2.5 rounded-full`,
      icon: 'h-10 w-10 rounded-full',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  children?: React.ReactNode;
}

/**
 * Interactive button component with multiple visual styles.
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="lg">Submit</Button>
 * <Button variant="secondary" size="md">Cancel</Button>
 * <Button variant="icon" size="icon"><CloseIcon /></Button>
 * ```
 *
 * @see {@link ../README.md} for detailed variant documentation
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
