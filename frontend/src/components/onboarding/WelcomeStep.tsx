import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, ReceiptText, Target } from 'lucide-react'
import dashboardHero from '@docs/images/dashboard-hero.png'
import { Badge, cn } from '@/ui/primitives'

type FeaturePalette = {
  gradient: string
  ring: string
  iconLight: string
  iconDark: string
  glow: string
}

type WelcomeFeature = {
  icon: LucideIcon
  title: string
  copy: string
  palette: FeaturePalette
}

const welcomeFeatures: WelcomeFeature[] = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    copy: 'Gain real insights into your finances, all in one place.',
    palette: {
      gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
      ring: 'ring-sky-300/35',
      iconLight: 'text-sky-700',
      iconDark: 'text-sky-100',
      glow: 'shadow-[0_16px_42px_-25px_rgba(14,165,233,0.55)]',
    },
  },
  {
    icon: ReceiptText,
    title: 'Transactions',
    copy: 'Track your spending line by line by account.',
    palette: {
      gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
      ring: 'ring-amber-300/35',
      iconLight: 'text-amber-700',
      iconDark: 'text-amber-100',
      glow: 'shadow-[0_16px_42px_-25px_rgba(245,158,11,0.55)]',
    },
  },
  {
    icon: Target,
    title: 'Budgets',
    copy: 'Set goals for your spending habits, and stick to them.',
    palette: {
      gradient: 'from-purple-400/55 via-purple-500/25 to-purple-500/5',
      ring: 'ring-purple-300/35',
      iconLight: 'text-purple-700',
      iconDark: 'text-purple-100',
      glow: 'shadow-[0_16px_42px_-25px_rgba(168,85,247,0.55)]',
    },
  },
]

function FeatureCard({ icon: Icon, title, copy, palette }: WelcomeFeature) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden flex h-full flex-col items-center justify-start rounded-xl border border-[#e2e8f0] bg-white px-4 py-4 text-center shadow-sm',
        'transition-all duration-300 ease-out hover:-translate-y-[2px] hover:shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)] hover:border-[#93c5fd]',
        'dark:border-[#334155] dark:bg-[#0f172a] dark:hover:border-[#38bdf8] dark:hover:shadow-[0_20px_56px_-40px_rgba(2,6,23,0.65)]'
      )}
    >
      <div className={cn('pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-slate-200/60 via-slate-100/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-slate-700/40 dark:via-slate-800/20')} />
      <span
        className={cn(
          'relative z-10 inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#f8fafc] ring-1 ring-inset',
          palette.ring,
          palette.glow,
          'transition-all duration-200 ease-out group-hover:scale-105',
          'dark:bg-[#1e293b]'
        )}
        aria-hidden="true"
      >
        <span className={cn('absolute inset-0 bg-gradient-to-br', palette.gradient)} />
        <span className={cn('absolute inset-[20%] rounded-full bg-slate-300/30 opacity-40 blur-[6px]', 'dark:bg-black/20')} />
        <Icon className={cn('relative h-5 w-5', palette.iconLight, `dark:${palette.iconDark}`)} strokeWidth={1.7} />
      </span>
      <p className={cn('relative z-10 mt-3 text-sm font-semibold text-[#0f172a]', 'dark:text-white')}>{title}</p>
      <p className={cn('relative z-10 mt-1 text-xs text-[#475569]', 'dark:text-[#cbd5e1]')}>{copy}</p>
    </div>
  )
}

export function WelcomeStep() {
  return (
    <div className={cn('grid items-start gap-8', 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]', 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]')}>
      <div className={cn('flex flex-col gap-8')}>
        <div className={cn('flex flex-col gap-5')}> 
          <Badge
            variant="feature"
            size="sm"
            className={cn('w-fit tracking-[0.3em] bg-sky-100/65 text-sky-600 dark:bg-sky-500/15 dark:text-sky-200')}
          >
            Welcome
          </Badge>

          <div className={cn('space-y-3')}> 
            <h1
              className={cn(
                'text-3xl font-bold tracking-tight text-slate-900 transition-colors duration-300 ease-out',
                'md:text-[2.6rem]',
                'dark:text-white'
              )}
            >
              Your new financial hub
            </h1>
            <p className={cn('text-base leading-relaxed text-slate-600 transition-colors duration-300 ease-out dark:text-slate-300')}>
              Bring every account into one secure place, watch budgets stay on track, and turn raw transactions into insights you can actually act on.
            </p>
          </div>
        </div>

        <div className={cn('flex flex-col gap-4')}>
          <div className={cn('text-[11px] font-semibold uppercase tracking-[0.3em] text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]')}>
            What you'll see
          </div>
          <div className={cn('grid gap-3 sm:grid-cols-3')}>
            {welcomeFeatures.map(feature => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </div>

      <div className={cn('relative flex flex-col self-start')}>
        <div className={cn('mb-3 mt-[52px] flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1] sm:mb-4')}>
          <span>Live Dashboard Preview</span>
        </div>
        <div
          className={cn(
            'relative aspect-[16/10] overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#0f172a] shadow-lg sm:aspect-[18/10]',
            'transition-all duration-300 ease-out',
            'dark:border-[#334155]'
          )}
        >
          <img
            src={dashboardHero}
            alt="Sumaura dashboard preview"
            className={cn('absolute inset-0 h-full w-full object-cover object-top')}
          />
        </div>
      </div>
    </div>
  )
}
