import type React from 'react';
import { primitiveTokenRecipes } from './recipes';
import { cn } from './utils';

export interface GradientShellProps {
  children: React.ReactNode;
  className?: string;
  centered?: boolean;
}

/**
 * Full-page background container with animated aura effects.
 *
 * @example
 * ```tsx
 * <GradientShell centered>
 *   <LoginForm />
 * </GradientShell>
 * ```
 *
 * @param centered - If true, centers content vertically and horizontally; default false for full-screen layout
 *
 * @see {@link ../README.md} for detailed documentation
 */
export function GradientShell({ children, className, centered = false }: GradientShellProps) {
  return (
    <div
      className={cn(
        'relative',
        centered ? 'min-h-screen overflow-hidden' : 'min-h-screen',
        className
      )}
    >
      <div className={cn('pointer-events-none', centered ? 'absolute inset-0' : 'fixed inset-0')}>
        <div className={cn('absolute inset-0', ...primitiveTokenRecipes.gradientShell.aura)} />

        <div className={cn('absolute inset-0', ...primitiveTokenRecipes.gradientShell.overlay)} />
        <div
          className={cn('absolute inset-0', ...primitiveTokenRecipes.gradientShell.violetAura)}
        />
        <div className={cn('absolute inset-0', ...primitiveTokenRecipes.gradientShell.cyanAura)} />

        <div className={cn('absolute', 'inset-0', 'flex', 'items-center', 'justify-center')}>
          <div
            className={cn(
              'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
              primitiveTokenRecipes.gradientShell.centerGlow
            )}
          />
        </div>

        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-b',
            primitiveTokenRecipes.gradientShell.vignette
          )}
        />

        <div
          className={cn('absolute inset-0', primitiveTokenRecipes.gradientShell.vignetteOverlay)}
        />
      </div>

      <div
        className={cn(
          ...primitiveTokenRecipes.gradientShell.base,
          centered ? primitiveTokenRecipes.gradientShell.centered : '',
          centered ? primitiveTokenRecipes.gradientShell.contentCentered : ''
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default GradientShell;
