import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { designTokens } from '@/ui/tokens';
import { inputControl } from './recipes';
import { cn } from './utils';

const inputVariants = cva([...inputControl.base], {
  variants: {
    variant: {
      default: [...inputControl.default],
      invalid: [...inputControl.invalid],
      glass: [...inputControl.glass],
    },
    inputSize: {
      sm: inputControl.size.sm,
      md: inputControl.size.md,
      lg: inputControl.size.lg,
    },
  },
  defaultVariants: {
    variant: 'default',
    inputSize: 'md',
  },
});

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {}

/**
 * Form input field with focus states and validation variants.
 *
 * @example
 * ```tsx
 * <Input
 *   type="email"
 *   placeholder="you@example.com"
 *   variant="default"
 *   inputSize="md"
 * />
 * <Input variant="invalid" placeholder="Error state" />
 * ```
 *
 * @see {@link ../README.md} for detailed variant documentation
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ variant, inputSize, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(inputVariants({ variant, inputSize }), className)}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export default Input;
