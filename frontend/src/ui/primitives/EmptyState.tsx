import type React from 'react';
import { primitiveTokenRecipes } from './recipes';
import { cn } from './utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
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
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-6 py-20 text-center sm:px-12',
        className
      )}
      {...props}
    >
      <div className={cn(...primitiveTokenRecipes.emptyState.iconWrapper)}>
        <Icon className={cn('h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10')} />
      </div>
      <div className={cn(primitiveTokenRecipes.emptyState.title)}>{title}</div>
      <div className={cn(primitiveTokenRecipes.emptyState.description)}>{description}</div>
      {action && <div className={cn('mt-2')}>{action}</div>}
    </div>
  );
}

export default EmptyState;
