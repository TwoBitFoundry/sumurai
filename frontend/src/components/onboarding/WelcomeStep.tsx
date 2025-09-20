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

        {/* Cards container flexes to fill remaining space so its bottom aligns with the image */}
        <div className="mt-6 flex flex-1 flex-col gap-4 rounded-2xl border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-slate-800/50 dark:bg-slate-900/60">
          <div className="grid h-full auto-rows-fr gap-3 items-stretch sm:grid-cols-3">
            {[
              { icon: '📊', title: 'Dashboard', copy: 'Gain real insights to what happens with your money' },
              { icon: '🧾', title: 'Transactions', copy: "Track your spending line by line" },
              { icon: '🎯', title: 'Budgets', copy: 'Set goals for your spending habits' },
            ].map(item => (
              <div key={item.title} className="flex h-full flex-col items-center justify-start rounded-xl bg-slate-100/70 px-4 py-3 text-center dark:bg-slate-800/70">
                <div className="text-xl" aria-hidden>
                  {item.icon}
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: dashboard hero image */}
      <div className="relative flex flex-col self-start lg:mt-[2.45rem]">
        <div className="pointer-events-none absolute -top-6 right-0 h-24 w-24 rounded-full bg-blue-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-8 h-32 w-32 rounded-full bg-purple-400/20 blur-3xl" />

        <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/50 shadow-2xl dark:ring-slate-800/50">
          <img
            src={dashboardHero}
            alt="Sumaura dashboard preview"
            className="block w-full h-auto object-contain object-top"
          />
        </div>
      </div>
    </div>
  )
}
