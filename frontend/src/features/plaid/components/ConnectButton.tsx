import { Plus } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/ui/primitives';

interface ConnectButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

const baseClasses =
  'inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none';

const variants: Record<'primary' | 'secondary', string> = {
  primary:
    'bg-gradient-to-r from-[#0ea5e9] via-[#38bdf8] to-[#a78bfa] text-white shadow-[0_22px_60px_-32px_rgba(14,165,233,0.78)] hover:-translate-y-[1px] hover:shadow-[0_28px_70px_-35px_rgba(14,165,233,0.85)] active:scale-[0.98] dark:shadow-[0_22px_60px_-32px_rgba(56,189,248,0.65)]',
  secondary:
    'border border-[#e2e8f0] bg-white/90 text-[#475569] shadow-[0_14px_38px_-30px_rgba(15,23,42,0.45)] hover:border-[#93c5fd] hover:text-[#0f172a] dark:border-[#334155] dark:bg-[#1e293b]/90 dark:text-[#cbd5e1] dark:hover:border-[#38bdf8] dark:hover:text-white',
};

const ConnectButton = ({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ConnectButtonProps) => {
  const variantClasses = variants[variant];
  return (
    <button
      type="button"
      className={`${baseClasses} ${variantClasses} ${className}`.trim()}
      {...props}
    >
      <Plus className={cn('h-4', 'w-4')} />
      <span>{children ?? 'Add account'}</span>
    </button>
  );
};

export default ConnectButton;
