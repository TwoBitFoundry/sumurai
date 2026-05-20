import type React from 'react';
import { IconButton, type IconButtonProps } from './IconButton';
import { cn } from './utils';

export type PaginationButtonProps = Omit<IconButtonProps, 'variant' | 'size'>;

export function PaginationButton({ className, children, ...props }: PaginationButtonProps) {
  return (
    <IconButton variant="ghost" size="sm" className={cn(className)} {...props}>
      {children}
    </IconButton>
  );
}

export default PaginationButton;
