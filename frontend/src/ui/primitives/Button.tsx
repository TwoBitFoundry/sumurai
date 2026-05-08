import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { designTokens } from '@/ui/tokens';
import { cn } from './utils';

export const buttonTypographySizes = {
  xs: designTokens.typography.label,
  sm: designTokens.typography.captionStrong,
  md: designTokens.typography.captionStrong,
  lg: designTokens.typography.bodyStrong,
} as const;

const buttonVariants = cva([...designTokens.components.button.base], {
  variants: {
    variant: {
      primary: [...designTokens.components.button.primary],
      secondary: [...designTokens.components.button.secondary],
      ghost: [...designTokens.components.button.ghost],
      icon: [...designTokens.components.button.icon],
      tab: [...designTokens.components.button.tab],
      tabActive: [...designTokens.components.button.tabActive],
      danger: [...designTokens.components.button.danger],
      success: [...designTokens.components.button.success],
      connect: [...designTokens.components.button.connect],
    },
    size: {
      xs: `${buttonTypographySizes.xs} px-2.5 py-1 rounded-xl`,
      sm: `${buttonTypographySizes.sm} px-3 py-1.5 rounded-xl`,
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
