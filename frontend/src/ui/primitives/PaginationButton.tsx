import type React from 'react';
import { Button, type ButtonProps } from './Button';
import { cn } from './utils';

export type PaginationButtonProps = Omit<ButtonProps, 'variant' | 'size'>;

export function PaginationButton({ className, children, ...props }: PaginationButtonProps) {
  return (
    <Button variant="icon" size="icon" className={cn(className)} {...props}>
      {children}
    </Button>
  );
}

export default PaginationButton;
