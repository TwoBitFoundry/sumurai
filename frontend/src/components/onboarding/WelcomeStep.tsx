import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, ReceiptText, Target } from 'lucide-react'
import dashboardHero from '@docs/images/dashboard-hero.png'

type FeaturePalette = {
  gradient: string
  ring: string
  icon: string
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
    copy: 'Gain real insights into your finances.',
    palette: {
      gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
      ring: 'ring-sky-300/35',
      icon: 'text-sky-100',
      glow: 'shadow-[0_16px_42px_-25px_rgba(14,165,233,0.55)]',
    },
  },
  {
    icon: ReceiptText,
    title: 'Transactions',
    copy: 'Track your spending line by line.',
    palette: {
      gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
      ring: 'ring-amber-300/35',
      icon: 'text-amber-100',
      glow: 'shadow-[0_16px_42px_-25px_rgba(245,158,11,0.55)]',
    },
  },
  {
    icon: Target,
    title: 'Budgets',
    copy: 'Set goals for your spending habits.',
    palette: {
      gradient: 'from-purple-400/55 via-purple-500/25 to-purple-500/5',
      ring: 'ring-purple-300/35',
      icon: 'text-purple-100',
      glow: 'shadow-[0_16px_42px_-25px_rgba(168,85,247,0.55)]',
    },
  },
]

export function WelcomeStep() {
  return (
    <div className="grid gap-8 items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="flex h-full flex-col text-left">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
            Welcome
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-[2.6rem]">
              Your new financial hub
            </h1>
            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
              Bring every account into one secure place, watch budgets stay on track, and turn raw
              transactions into insights you can actually act on.
            </p>
          </div>
        </div>

        {/* Cards container flexes to fill remaining space so its bottom aligns with the image */}
        <div className="mt-6 flex flex-1 flex-col gap-4 rounded-2xl border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-slate-800/50 dark:bg-slate-900/60">
          <div className="grid h-full auto-rows-fr gap-3 items-stretch sm:grid-cols-3">
            {welcomeFeatures.map(({ icon: Icon, title, copy, palette }) => (
              <div
                key={title}
                className="flex h-full flex-col items-center justify-start rounded-xl border border-white/10 bg-slate-900/80 px-4 py-4 text-center text-slate-300 shadow-[0_18px_42px_-26px_rgba(15,23,42,0.85)] backdrop-blur dark:border-slate-700/60 dark:bg-slate-950/60"
              >
                <span
                  className={`relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-slate-950/60 ring-1 ring-inset ${palette.ring} ${palette.glow}`}
                  aria-hidden="true"
                >
                  <span className={`absolute inset-0 bg-gradient-to-br ${palette.gradient}`} />
                  <span className="absolute inset-[20%] rounded-full bg-black/20 blur-[6px] opacity-40" />
                  <Icon className={`relative h-5 w-5 ${palette.icon}`} strokeWidth={1.7} />
                </span>
                <p className="mt-2 text-sm font-semibold text-slate-100">{title}</p>
                <p className="mt-1 text-xs text-slate-400">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: dashboard hero image */}
      <div className="relative flex flex-col self-start lg:mt-[2.45rem]">
        <div className="pointer-events-none absolute -top-6 right-0 h-24 w-24 rounded-full bg-blue-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-8 h-32 w-32 rounded-full bg-purple-400/20 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 rounded-2xl bg-white/80 p-6 shadow-2xl ring-1 ring-white/50 backdrop-blur dark:bg-slate-900/70 dark:ring-slate-800/50">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 sm:mb-1">
            <span>What you'll see</span>
            <span className="hidden text-[10px] tracking-[0.25em] text-slate-400 sm:inline">Live dashboard preview</span>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 ring-1 ring-inset ring-white/15 ring-offset-2 ring-offset-white/70 shadow-[0_18px_46px_-28px_rgba(15,23,42,0.9)] dark:border-slate-800/40 dark:bg-slate-950/50 dark:ring-slate-800/60 dark:ring-offset-slate-900/80 sm:aspect-[18/10]">
            <img
              src={dashboardHero}
              alt="Sumaura dashboard preview"
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
