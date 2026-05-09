import { cva, type VariantProps } from 'class-variance-authority';
import type React from 'react';
import { iconButton } from './recipes';
import { cn } from './utils';

const iconButtonVariants = cva(iconButton.ghost.join(' '), {
  variants: {
    variant: {
      ghost: iconButton.ghost.join(' '),
      success: iconButton.success.join(' '),
      danger: iconButton.danger.join(' '),
    },
  },
  defaultVariants: {
    variant: 'ghost',
  },
});

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  children: React.ReactNode;
}

export function IconButton({ variant, className, children, ...props }: IconButtonProps) {
  return (
    <button type="button" className={cn(iconButtonVariants({ variant }), className)} {...props}>
      {children}
    </button>
  );
}

export default IconButton;
