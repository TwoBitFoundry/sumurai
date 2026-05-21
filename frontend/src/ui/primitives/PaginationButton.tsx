import type React from 'react';
import { IconButton, type IconButtonProps } from './IconButton';
import { cn } from './utils';

export type PaginationButtonProps = Omit<IconButtonProps, 'variant'>;

export function PaginationButton({
  className,
  children,
  size = 'md',
  ...props
}: PaginationButtonProps) {
  return (
    <IconButton variant="ghost" size={size} className={cn(className)} {...props}>
      {children}
    </IconButton>
  );
}

export default PaginationButton;
