import type React from 'react';
import {
  surface as semanticSurfaces,
  text as semanticTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { cn } from './utils';

export const emptyStateRecipes = {
  iconWrapper: [
    'flex',
    'h-12 w-12 md:h-16 md:w-16 lg:h-20 lg:w-20',
    'items-center',
    'justify-center',
    'rounded-full',
    ...semanticSurfaces.card,
    semanticTextRecipes.muted,
    'transition-colors duration-300 ease-out',
    'hover:shadow-[0_0_30px_var(--color-effect-accent-hover),0_0_60px_var(--color-effect-accent-hover)]',
    'dark:text-slate-300',
    'dark:hover:shadow-[0_0_30px_var(--color-effect-accent-hover),0_0_60px_var(--color-effect-accent-hover)]',
    'cursor-pointer',
  ],
  title: `${uiTypographyRecipes.cardTitle} ${semanticTextRecipes.primary} transition-colors duration-500`,
  description: `${uiTypographyRecipes.body} max-w-sm ${semanticTextRecipes.body} transition-colors duration-500`,
} as const;

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
        'flex flex-col items-center justify-center gap-4 px-6 py-20 text-center md:px-12',
        className
      )}
      {...props}
    >
      <div className={cn(...emptyStateRecipes.iconWrapper)}>
        <Icon className={cn('h-6 w-6 md:h-8 md:w-8 lg:h-10 lg:w-10')} />
      </div>
      <div className={cn(emptyStateRecipes.title)}>{title}</div>
      <div className={cn(emptyStateRecipes.description)}>{description}</div>
      {action && <div className={cn('mt-2')}>{action}</div>}
    </div>
  );
}

export default EmptyState;
