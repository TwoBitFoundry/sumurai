import React from 'react'

interface ConnectAccountStepProps {
  isConnected: boolean
  connectionInProgress: boolean
  institutionName: string | null
  error: string | null
  onConnect: () => void
  onRetry: () => void
}

export function ConnectAccountStep({
  isConnected,
  connectionInProgress,
  institutionName,
  error,
  onConnect,
  onRetry,
}: ConnectAccountStepProps) {
  if (isConnected) {
    return (
      <div className="grid gap-8 items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex h-full flex-col text-left">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
              Connected
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-[2.6rem]">
              {institutionName ?? 'Your bank'} is linked
            </h1>
            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
              Transactions will begin syncing in the background. We will nudge you once everything is ready in your dashboard.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-5 text-sm text-emerald-800 shadow-sm backdrop-blur dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-200">
            <div className="flex items-center gap-3">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">Sync started</p>
                <p>Your accounts refresh automatically every few hours.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xl">📬</span>
              <p>Watch for a quick tour of your new analytics once data lands.</p>
            </div>
          </div>
        </div>

        <div className="flex h-full flex-col rounded-2xl border border-white/60 bg-white/80 p-5 text-left shadow-lg backdrop-blur dark:border-slate-800/50 dark:bg-slate-900/70">
          <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            <span>Status</span>
            <span>Secure</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
            <span>Connection established</span>
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Your financial data is read-only. We cannot move or change funds, and credentials never touch our servers.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-8 items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="flex h-full flex-col text-left">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
            Plaid Secure Link
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-[2.6rem]">
              Connect your bank
            </h1>
            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
              Securely link accounts to unlock live dashboards and automated budgets. Plaid uses industry-standard encryption so your credentials remain private.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-200/60 bg-red-50/80 p-4 text-sm text-red-700 shadow-sm backdrop-blur dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-200">
            <p className="font-semibold">Connection failed</p>
            <p className="mt-1 text-xs text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-slate-800/50 dark:bg-slate-900/70">
          <div className="grid auto-rows-fr gap-3 sm:grid-cols-3">
            {[
              { icon: '🔒', title: 'Secure', body: 'Bank-grade encryption and read-only access.' },
              { icon: '⚡', title: 'Fast', body: 'Most connections finish in under a minute.' },
              { icon: '🏦', title: '11k+ banks', body: 'Covering major institutions and credit unions.' },
            ].map(feature => (
              <div key={feature.title} className="flex h-full flex-col justify-between rounded-xl bg-slate-100/70 px-4 py-3 text-center dark:bg-slate-800/70">
                <div className="text-xl">{feature.icon}</div>
                <div>
                  <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {feature.title}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{feature.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex h-full flex-col lg:mt-[2.45rem]">
        <div className="pointer-events-none absolute -top-6 right-0 h-24 w-24 rounded-full bg-blue-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-8 h-32 w-32 rounded-full bg-purple-400/20 blur-3xl" />

        <div className="relative z-10 flex flex-col rounded-2xl bg-white/80 p-6 shadow-2xl ring-1 ring-white/50 backdrop-blur dark:bg-slate-900/70 dark:ring-slate-800/50">
          <div className="mb-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            <span>Why Plaid?</span>
            <span>Trusted by 12k+ apps</span>
          </div>
          <div className="flex flex-1 flex-col justify-between gap-4">
            <div className="grid auto-rows-max gap-2 sm:grid-cols-2">
              {[
                {
                  icon: '🏛️',
                  title: 'Independent linking',
                  body: 'Credentials never touch our servers—Plaid brokers every session.',
                },
                {
                  icon: '🛡️',
                  title: 'Protected access',
                  body: 'MFA, device fingerprinting, and tokenization guard each sync.',
                },
                {
                  icon: '📜',
                  title: 'You stay in control',
                  body: 'Disconnect anytime from Settings—data access stops instantly.',
                },
                {
                  icon: '👀',
                  title: 'Preview first',
                  body: 'Not ready yet? Explore demo insights and link when you are.',
                },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-2 rounded-xl bg-slate-100/70 px-3 py-2 text-[13px] text-slate-600 shadow-sm dark:bg-slate-800/60 dark:text-slate-300">
                  <span className="mt-px text-base">{item.icon}</span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                    <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={error ? onRetry : onConnect}
              disabled={connectionInProgress}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-6 py-3 text-base font-semibold text-white shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
            >
              {connectionInProgress ? (
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Connecting...
                </span>
              ) : error ? (
                'Try again'
              ) : (
                <>
                  <span>Connect with Plaid</span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">Secure</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
