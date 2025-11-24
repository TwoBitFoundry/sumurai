import React from 'react'
import { cn } from './utils'

export interface GradientShellProps {
  children: React.ReactNode
  className?: string
  centered?: boolean
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
export function GradientShell({
  children,
  className,
  centered = false,
}: GradientShellProps) {
  return (
    <div
      className={cn(
        'relative',
        centered ? 'min-h-screen overflow-hidden' : 'min-h-screen',
        className
      )}
    >
      <div className={cn(
        'pointer-events-none',
        centered ? 'absolute inset-0' : 'fixed inset-0'
      )}>
        <div
          className={cn(
            'absolute inset-0',
            'bg-[radial-gradient(128%_96%_at_18%_-20%,#c4e2ff_0%,#dbeafe_30%,#e5f2ff_56%,#ffffff_96%)]',
            'transition-colors duration-500 ease-out',
            'dark:bg-[radial-gradient(100%_85%_at_20%_-10%,#0f172a_0%,#0b162c_55%,#05070d_100%)]'
          )}
        />

        <div className={cn('absolute', 'inset-0', 'bg-[radial-gradient(136%_108%_at_20%_-18%,rgba(14,165,233,0.42)_0%,#e1f2ff_36%,#ffffff_100%)]', 'transition-colors', 'duration-700', 'dark:bg-[radial-gradient(92%_80%_at_20%_-6%,#0f172a_0%,#0a1224_50%,#05070d_100%)]')} />
        <div className={cn('absolute', 'inset-0', 'bg-[radial-gradient(86%_64%_at_86%_18%,rgba(167,139,250,0.28)_0%,rgba(59,130,246,0.14)_55%,transparent_78%)]', 'transition-opacity', 'duration-700', 'dark:bg-transparent')} />
        <div className={cn('absolute', 'inset-0', 'bg-[radial-gradient(92%_68%_at_12%_24%,rgba(56,189,248,0.28)_0%,rgba(129,140,248,0.12)_52%,transparent_80%)]', 'transition-opacity', 'duration-700', 'dark:bg-transparent')} />

        <div className={cn('absolute', 'inset-0', 'flex', 'items-center', 'justify-center')}>
          <div
            className={cn(
              'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
              'rounded-full blur-3xl',
              'h-[72rem] w-[72rem]',
              'opacity-[0.28] animate-[rotateAura_95s_linear_infinite]',
              'bg-[conic-gradient(from_90deg,#93c5fd,#34d399,#fbbf24,#a78bfa,#fb7185,#93c5fd)]',
              'transition-opacity duration-500',
              'dark:opacity-[0.4] dark:bg-[conic-gradient(from_110deg,#38bdf8,#34d399,#a78bfa,#fbbf24,#f87171,#38bdf8)]'
            )}
          />
        </div>

        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-b',
            'from-white/70 via-white/',
            'via-white/38',
            'to-transparent',
            'transition-colors',
            'duration-700',
            'ease-out',
            'dark:from-slate-900/68 dark:via-slate-900/42',
            'dark:to-transparent'
          )}
        />

        <div
          className={cn(
            'absolute inset-0',
            'bg-[radial-gradient(120%_120%_at_50%_55%,transparent_60%,rgba(15,23,42,0.1)_100%)]',
            'transition-opacity',
            'duration-700',
            'ease-out',
            'dark:bg-[radial-gradient(120%_120%_at_50%_54%,transparent_58%,rgba(2,6,23,0.38)_100%)]'
          )}
        />
      </div>

      <div
        className={cn(
          'relative',
          centered ? 'flex min-h-screen items-center justify-center px-4 py-12 sm:px-6' : ''
        )}
      >
        {children}
      </div>
    </div>
  )
}

export default GradientShell