import { Link } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { Button, cn } from '@/ui/primitives';
import { control } from '@/ui/recipes';

interface ConnectButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

const ConnectButton = ({
  variant = 'primary',
  className = '',
  children,
  size = 'md',
  ...props
}: ConnectButtonProps & { size?: 'sm' | 'md' | 'lg' }) => {
  const buttonVariant = variant === 'secondary' ? 'secondary' : 'connect';
  return (
    <Button
      type="button"
      variant={buttonVariant}
      size={size}
      className={cn('normal-case', className)}
      {...props}
    >
      <Link aria-hidden className={control.glyph[size]} />
      <span>{children ?? 'Add ally account'}</span>
    </Button>
  );
};

export default ConnectButton;
