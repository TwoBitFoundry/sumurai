import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { selectControl } from './recipes';
import { cn } from './utils';

const selectVariants = cva([...selectControl.base], {
  variants: {
    variant: {
      default: [...selectControl.default],
      invalid: [...selectControl.invalid],
      glass: [...selectControl.glass],
    },
    selectSize: {
      sm: selectControl.size.sm,
      md: selectControl.size.md,
      lg: selectControl.size.lg,
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
