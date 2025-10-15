import React from 'react'
import { cn } from './utils'

export interface GradientShellProps {
  children: React.ReactNode
  className?: string
  variant?: 'auth' | 'app'
}

export function GradientShell({
  children,
  className,
  variant = 'auth',
}: GradientShellProps) {
  return (
    <div
      className={cn(
        'relative',
        variant === 'auth' ? 'min-h-[calc(100vh-4rem)]' : 'min-h-screen',
        'overflow-hidden',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className={cn(
            'absolute inset-0',
            variant === 'auth'
              ? 'bg-[radial-gradient(110%_90%_at_15%_-10%,#f8fafc_0%,#f1f5f9_45%,#ffffff_100%)]'
              : 'bg-[radial-gradient(128%_96%_at_18%_-20%,#c4e2ff_0%,#dbeafe_30%,#e5f2ff_56%,#ffffff_96%)]',
            'transition-colors duration-500 ease-out',
            variant === 'auth'
              ? 'dark:bg-[radial-gradient(90%_70%_at_20%_0%,#0f172a_0%,#0a0f1b_50%,#05070d_100%)]'
              : 'dark:bg-[radial-gradient(100%_85%_at_20%_-10%,#0f172a_0%,#0b162c_55%,#05070d_100%)]'
          )}
        />

        {variant === 'app' && (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(136%_108%_at_20%_-18%,rgba(14,165,233,0.42)_0%,#e1f2ff_36%,#ffffff_100%)] transition-colors duration-700 dark:bg-[radial-gradient(92%_80%_at_20%_-6%,#0f172a_0%,#0a1224_50%,#05070d_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(86%_64%_at_86%_18%,rgba(167,139,250,0.28)_0%,rgba(59,130,246,0.14)_55%,transparent_78%)] transition-opacity duration-700 dark:bg-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(92%_68%_at_12%_24%,rgba(56,189,248,0.28)_0%,rgba(129,140,248,0.12)_52%,transparent_80%)] transition-opacity duration-700 dark:bg-transparent" />
          </>
        )}

        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
              'rounded-full blur-3xl',
              variant === 'auth' ? 'h-[60rem] w-[60rem]' : 'h-[72rem] w-[72rem]',
              variant === 'auth'
                ? 'opacity-[0.22] animate-[rotateAura_100s_linear_infinite]'
                : 'opacity-[0.28] animate-[rotateAura_95s_linear_infinite]',
              variant === 'auth'
                ? 'bg-[conic-gradient(from_0deg,#93c5fd_0deg,#34d399_150deg,#fbbf24_260deg,#a78bfa_340deg,#93c5fd_360deg)]'
                : 'bg-[conic-gradient(from_90deg,#93c5fd,#34d399,#fbbf24,#a78bfa,#fb7185,#93c5fd)]',
              'transition-opacity duration-500',
              variant === 'auth'
                ? 'dark:opacity-[0.34] dark:bg-[conic-gradient(from_0deg,#38bdf8_0deg,#34d399_140deg,#a78bfa_250deg,#fbbf24_310deg,#f87171_350deg,#38bdf8_360deg)]'
                : 'dark:opacity-[0.4] dark:bg-[conic-gradient(from_110deg,#38bdf8,#34d399,#a78bfa,#fbbf24,#f87171,#38bdf8)]'
            )}
          />
        </div>

        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-b',
            'from-white/70 via-white/',
            variant === 'auth' ? 'via-white/45' : 'via-white/38',
            'to-transparent',
            'transition-colors duration-',
            variant === 'auth' ? 'duration-500' : 'duration-700',
            'ease-out',
            variant === 'auth'
              ? 'dark:from-slate-900/70 dark:via-slate-900/40'
              : 'dark:from-slate-900/68 dark:via-slate-900/42',
            'dark:to-transparent'
          )}
        />

        <div
          className={cn(
            'absolute inset-0',
            'bg-[radial-gradient(120%_120%_at_50%_',
            variant === 'auth' ? '50%' : '55%',
            ',transparent_',
            variant === 'auth' ? '58%' : '60%',
            ',rgba(15,23,42,0.1)_100%)]',
            'transition-opacity duration-',
            variant === 'auth' ? 'duration-500' : 'duration-700',
            'ease-out',
            variant === 'auth'
              ? 'dark:bg-[radial-gradient(120%_120%_at_50%_50%,transparent_56%,rgba(2,6,23,0.32)_100%)]'
              : 'dark:bg-[radial-gradient(120%_120%_at_50%_54%,transparent_58%,rgba(2,6,23,0.38)_100%)]'
          )}
        />
      </div>

      <div
        className={cn(
          'relative z-10',
          variant === 'auth' ? 'flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 sm:px-6' : 'flex min-h-screen flex-col'
        )}
      >
        {children}
      </div>
    </div>
  )
}

export default GradientShell
