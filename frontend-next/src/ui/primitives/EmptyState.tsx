import React from 'react'
import { cn } from './utils'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
}

/**
 * Empty state display with theme-aware icon and responsive sizing.
 *
 * @example
 * ```tsx
 * import { Target } from 'lucide-react'
 * <EmptyState
 *   icon={Target}
 *   title="No budgets found"
 *   description="Create your first category plan to watch spending settle into rhythm."
 *   action={<button>Add budget</button>}
 * />
 * ```
 *
 * @param icon - Lucide-react icon component
 * @param title - Main heading text
 * @param description - Supporting description text
 * @param action - Optional action button or element
 *
 * @see {@link ../README.md} for detailed documentation
 */
export function EmptyState({ icon: Icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn('flex', 'flex-col', 'items-center', 'justify-center', 'gap-4', 'px-6', 'py-20', 'text-center', 'sm:px-12', className)}
      {...props}
    >
      <div
        className={cn(
          'flex',
          'h-12 w-12 md:h-16 md:w-16 lg:h-20 lg:w-20',
          'items-center',
          'justify-center',
          'rounded-full',
          'bg-gradient-to-br',
          'from-slate-400/10 via-slate-300/15 to-slate-500/10',
          'text-slate-600',
          'transition-all duration-300 ease-out',
          'hover:scale-110 hover:-translate-y-1',
          'hover:shadow-[0_0_30px_rgba(59,130,246,0.4),0_0_60px_rgba(59,130,246,0.2)]',
          'dark:text-slate-300',
          'dark:from-slate-500/10 dark:via-slate-600/15 dark:to-slate-700/10',
          'dark:hover:shadow-[0_0_30px_rgba(96,165,250,0.5),0_0_60px_rgba(96,165,250,0.25)]',
          'cursor-pointer'
        )}
      >
        <Icon className={cn('h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10')} />
      </div>
      <div className={cn('text-lg', 'font-semibold', 'text-slate-700', 'transition-colors', 'duration-500', 'dark:text-slate-200')}>
        {title}
      </div>
      <div className={cn('text-sm', 'text-slate-500', 'transition-colors', 'duration-500', 'dark:text-slate-400', 'max-w-sm')}>
        {description}
      </div>
      {action && <div className={cn('mt-2')}>{action}</div>}
    </div>
  )
}

export default EmptyState
