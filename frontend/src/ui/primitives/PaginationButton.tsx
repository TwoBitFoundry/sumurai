import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { paginationButton } from './recipes';
import { cn } from './utils';

const paginationButtonVariants = cva(paginationButton.join(' '), {
  variants: {
    variant: {
      default: paginationButton.join(' '),
      disabled: paginationButton.join(' '),
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface PaginationButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof paginationButtonVariants> {
  children: React.ReactNode;
}

export function PaginationButton({
  variant,
  className,
  children,
  ...props
}: PaginationButtonProps) {
  return (
    <button
      type="button"
      className={cn(paginationButtonVariants({ variant }), className)}
      {...props}
    >
      {children}
    </button>
  );
}

export default PaginationButton;
