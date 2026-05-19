import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { inputControl } from './Input';
import { cn } from './utils';

export const selectControl = inputControl;

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

export const Select = ({
  variant,
  selectSize,
  className,
  ref,
  ...props
}: SelectProps & { ref?: React.RefObject<HTMLSelectElement | null> }) => {
  return (
    <select
      ref={ref}
      className={cn(selectVariants({ variant, selectSize }), className)}
      {...props}
    />
  );
};

Select.displayName = 'Select';

export default Select;
