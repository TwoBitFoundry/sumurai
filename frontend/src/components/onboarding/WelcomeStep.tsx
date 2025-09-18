import React from 'react'
import dashboardHero from '@docs/images/dashboard-hero.png'

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

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-slate-800/50 dark:bg-slate-900/60">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: '📊', title: 'Dashboard', copy: 'Gain real insights' },
              { icon: '🧾', title: 'Transactions', copy: "Track your spending" },
              { icon: '🎯', title: 'Budgets', copy: 'Meet your goals' },
            ].map(item => (
              <div key={item.title} className="rounded-xl bg-slate-100/70 px-4 py-3 text-center dark:bg-slate-800/70">
                <div className="text-xl" aria-hidden>{item.icon}</div>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: dashboard hero image */}
      <div className="relative flex h-full flex-col lg:mt-[2.45rem]">
        <div className="pointer-events-none absolute -top-6 right-0 h-24 w-24 rounded-full bg-blue-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-8 h-32 w-32 rounded-full bg-purple-400/20 blur-3xl" />

        <div className="relative flex-1 overflow-hidden rounded-2xl ring-1 ring-white/50 shadow-2xl dark:ring-slate-800/50">
          <img
            src={dashboardHero}
            alt="Sumaura dashboard preview"
            className="block h-full w-full object-cover object-left-top"
          />
        </div>
      </div>
      <div className="hidden md:block md:col-span-2" aria-hidden="true">
        <div className="h-10 lg:h-14 xl:h-16" />
      </div>
    </div>
  )
}
