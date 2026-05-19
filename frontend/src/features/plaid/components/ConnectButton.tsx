import { Plus } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { Button, cn } from '@/ui/primitives';

interface ConnectButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  leadingImageSrc?: string;
}

const ConnectButton = ({
  variant = 'primary',
  className = '',
  leadingImageSrc,
  children,
  ...props
}: ConnectButtonProps) => {
  const buttonVariant = variant === 'secondary' ? 'secondary' : 'connect';
  return (
    <Button type="button" variant={buttonVariant} className={cn(className)} {...props}>
      {leadingImageSrc ? (
        <img
          src={leadingImageSrc}
          alt=""
          aria-hidden="true"
          className={cn('h-5', 'w-5', 'rounded-[length:var(--radius-medium)]', 'object-cover')}
        />
      ) : (
        <Plus className={cn('h-4', 'w-4')} />
      )}
      <span>{children ?? 'Add account'}</span>
    </Button>
  );
};

export default ConnectButton;
