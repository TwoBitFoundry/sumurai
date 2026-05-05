import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { designTokens } from '@/ui/tokens';
import { cn } from './utils';

const inputVariants = cva(
  [...designTokens.components.input.base],
  {
    variants: {
      variant: {
        default: [...designTokens.components.input.default],
        invalid: [...designTokens.components.input.invalid],
        glass: [...designTokens.components.input.glass],
      },
      inputSize: {
        sm: 'py-1.5 text-xs rounded-lg',
        md: 'py-2.5 text-sm rounded-xl',
        lg: 'py-3 text-base rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      inputSize: 'md',
    },
  }
);

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
