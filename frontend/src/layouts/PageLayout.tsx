import { type ReactNode } from 'react'
import { cn } from '../ui/primitives/utils'

interface PageLayoutProps {
  badge?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  stats?: ReactNode
  error?: string | null
  children?: ReactNode
  className?: string
}

export function PageLayout({
  badge,
  title,
  subtitle,
  actions,
  stats,
  error,
  children,
  className
}: PageLayoutProps) {
  return (
    <div className={cn('space-y-8', className)}>
      <section className="relative overflow-hidden rounded-[2.25rem] border border-white/35 bg-white/24 p-8 shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)] backdrop-blur-[28px] backdrop-saturate-[150%] transition-colors duration-500 ease-out dark:border-white/12 dark:bg-[#0f172a]/55 dark:shadow-[0_36px_120px_-62px_rgba(2,6,23,0.85)] sm:p-12">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-[1px] rounded-[2.2rem] ring-1 ring-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-1px_0_rgba(15,23,42,0.18)] dark:ring-white/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(2,6,23,0.48)]" />
          <div className="absolute inset-0 rounded-[2.2rem] bg-gradient-to-b from-white/72 via-white/28 to-transparent transition-colors duration-500 dark:from-slate-900/68 dark:via-slate-900/34 dark:to-transparent" />
        </div>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-4">
              {badge && (
                <span className="inline-flex items-center justify-center rounded-full bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-600 shadow-[0_16px_42px_-30px_rgba(15,23,42,0.45)] dark:bg-[#1e293b]/75 dark:text-slate-200">
                  {badge}
                </span>
              )}
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 transition-colors duration-300 ease-out dark:text-white sm:text-4xl">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-base leading-relaxed text-slate-600 transition-colors duration-300 ease-out dark:text-slate-300">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            {actions && (
              <div className="flex flex-wrap items-center justify-start gap-3">
                {actions}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200/70 bg-red-50/80 px-5 py-3 shadow-sm dark:border-red-700/60 dark:bg-red-900/25">
              <div className="text-sm font-medium text-red-600 dark:text-red-300">Error: {error}</div>
            </div>
          )}

          {stats && stats}
        </div>
      </section>

      {children}
    </div>
  )
}

export default PageLayout
