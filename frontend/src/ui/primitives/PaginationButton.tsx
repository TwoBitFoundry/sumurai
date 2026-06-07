import type React from 'react';
import { Button, type ButtonProps } from './Button';
import { cn } from './utils';

export type PaginationButtonProps = Omit<ButtonProps, 'variant' | 'shape' | 'loading'>;

export function PaginationButton({
  className,
  children,
  size = 'md',
  ...props
}: PaginationButtonProps) {
  return (
    <Button variant="secondary" shape="square" size={size} className={cn(className)} {...props}>
      {children}
    </Button>
  );
}

export default PaginationButton;
