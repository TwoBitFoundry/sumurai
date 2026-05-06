import { Plus } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';

interface ConnectButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

const ConnectButton = ({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ConnectButtonProps) => {
  const variantClasses =
    variant === 'primary'
      ? designTokens.components.button.connect
      : designTokens.components.connectButton.secondary;
  return (
    <button
      type="button"
      className={cn(designTokens.components.connectButton.base, variantClasses, className)}
      {...props}
    >
      <Plus className={cn('h-4', 'w-4')} />
      <span>{children ?? 'Add account'}</span>
    </button>
  );
};

export default ConnectButton;
