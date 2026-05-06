import { Plus } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { Button, cn } from '@/ui/primitives';

interface ConnectButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

const ConnectButton = ({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ConnectButtonProps) => {
  const buttonVariant = variant === 'secondary' ? 'secondary' : 'connect';
  return (
    <Button
      type="button"
      variant={buttonVariant}
      className={cn(className)}
      {...props}
    >
      <Plus className={cn('h-4', 'w-4')} />
      <span>{children ?? 'Add account'}</span>
    </Button>
  );
};

export default ConnectButton;
