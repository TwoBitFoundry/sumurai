import { Plus } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

interface ConnectButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

const baseClasses = 'inline-flex h-9 items-center gap-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors duration-150'
const variants: Record<'primary' | 'secondary', string> = {
  primary: 'bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white shadow px-3',
  secondary: 'border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-transparent text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 font-medium px-4 py-2',
}

const ConnectButton = ({ variant = 'primary', className = '', children, ...props }: ConnectButtonProps) => {
  const variantClasses = variants[variant]
  return (
    <button
      type="button"
      className={`${baseClasses} ${variantClasses} ${className}`.trim()}
      {...props}
    >
      <Plus className="h-4 w-4" />
      <span>{children ?? 'Add bank'}</span>
    </button>
  )
}

export default ConnectButton
