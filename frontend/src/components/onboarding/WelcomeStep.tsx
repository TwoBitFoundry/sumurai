import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, ReceiptText, Target } from 'lucide-react'
import dashboardHero from '@docs/images/dashboard-hero.png'

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

export function WelcomeStep() {
  return (
    <div className="grid gap-8 items-start lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="flex flex-col space-y-8">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#93c5fd]/20 dark:bg-[#38bdf8]/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#0ea5e9] dark:text-[#38bdf8] transition-colors duration-300 ease-out">
            Welcome
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-[#0f172a] dark:text-white md:text-[2.6rem] transition-colors duration-300 ease-out">
              Your new financial hub
            </h1>
            <p className="text-base leading-relaxed text-[#475569] dark:text-[#cbd5e1] transition-colors duration-300 ease-out">
              Bring every account into one secure place, watch budgets stay on track, and turn raw
              transactions into insights you can actually act on.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {welcomeFeatures.map(({ icon: Icon, title, copy, palette }, index) => (
            <div
              key={title}
              className="group flex h-full flex-col items-center justify-start rounded-xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#0f172a] px-4 py-4 text-center shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:border-[#93c5fd] dark:hover:border-[#38bdf8]"
              style={{ animationDelay: `${150 + index * 50}ms` }}
            >
              <span
                className={`relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#f8fafc] dark:bg-[#1e293b] ring-1 ring-inset ${palette.ring} ${palette.glow} transition-all duration-200 ease-out group-hover:scale-105`}
                aria-hidden="true"
              >
                <span className={`absolute inset-0 bg-gradient-to-br ${palette.gradient}`} />
                <span className="absolute inset-[20%] rounded-full bg-slate-300/30 blur-[6px] opacity-40 dark:bg-black/20 transition-colors duration-300 ease-out" />
                <Icon className={`relative h-5 w-5 ${palette.iconLight} dark:${palette.iconDark} transition-colors duration-300 ease-out`} strokeWidth={1.7} />
              </span>
              <p className="mt-3 text-sm font-semibold text-[#0f172a] dark:text-white transition-colors duration-300 ease-out">{title}</p>
              <p className="mt-1 text-xs text-[#475569] dark:text-[#cbd5e1] transition-colors duration-300 ease-out">{copy}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex flex-col self-start lg:mt-[2.45rem]">
        <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-[#475569] dark:text-[#cbd5e1] sm:mb-4 transition-colors duration-300 ease-out">
          <span>Live Dashboard Preview</span>
        </div>
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-[#0f172a] shadow-lg sm:aspect-[18/10] transition-all duration-300 ease-out">
          <img
            src={dashboardHero}
            alt="Sumaura dashboard preview"
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        </div>
      </div>
    </div>
  )
}
