import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { designTokens } from '@/ui/tokens';
import { cn } from './utils';

const selectVariants = cva([...designTokens.components.select.base], {
  variants: {
    variant: {
      default: [...designTokens.components.select.default],
      invalid: [...designTokens.components.select.invalid],
      glass: [...designTokens.components.select.glass],
    },
    selectSize: {
      sm: designTokens.components.select.size.sm,
      md: designTokens.components.select.size.md,
      lg: designTokens.components.select.size.lg,
    },
  },
  defaultVariants: {
    variant: 'default',
    selectSize: 'md',
  },
});

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof selectVariants> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ variant, selectSize, className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(selectVariants({ variant, selectSize }), className)}
        {...props}
      />
    );
  }
);

Select.displayName = 'Select';

export default Select;
