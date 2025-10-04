import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Building2, Eye, Fingerprint, Landmark, ShieldCheck, Zap } from 'lucide-react'

type HighlightPalette = {
  gradient: string
  ring: string
  iconLight: string
  iconDark: string
  glow: string
}

type PlaidHighlight = {
  icon: LucideIcon
  title: string
  body: string
  palette: HighlightPalette
}

type FeaturePalette = {
  gradient: string
  ring: string
  iconLight: string
  iconDark: string
  glow: string
}

type FeatureHighlight = {
  icon: LucideIcon
  title: string
  body: string
  palette: FeaturePalette
}

const plaidHighlights: PlaidHighlight[] = [
  {
    icon: Building2,
    title: 'Independent linking',
    body: 'Credentials never touch our servers—Plaid brokers every session.',
    palette: {
      gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
      ring: 'ring-amber-300/35',
      iconLight: 'text-amber-700',
      iconDark: 'text-amber-200',
      glow: 'shadow-[0_18px_45px_-25px_rgba(245,158,11,0.65)]',
    },
  },
  {
    icon: ShieldCheck,
    title: 'Protected access',
    body: 'MFA, device fingerprinting, and tokenization guard each sync.',
    palette: {
      gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
      ring: 'ring-sky-300/35',
      iconLight: 'text-sky-700',
      iconDark: 'text-sky-200',
      glow: 'shadow-[0_18px_45px_-25px_rgba(14,165,233,0.6)]',
    },
  },
  {
    icon: Fingerprint,
    title: 'You stay in control',
    body: 'Disconnect anytime from Settings—data access stops instantly.',
    palette: {
      gradient: 'from-violet-400/55 via-violet-500/25 to-violet-500/5',
      ring: 'ring-violet-300/35',
      iconLight: 'text-violet-700',
      iconDark: 'text-violet-200',
      glow: 'shadow-[0_18px_45px_-25px_rgba(139,92,246,0.6)]',
    },
  },
  {
    icon: Eye,
    title: 'Preview first',
    body: 'Not ready yet? Explore demo insights and link when you are.',
    palette: {
      gradient: 'from-fuchsia-400/55 via-fuchsia-500/25 to-fuchsia-500/5',
      ring: 'ring-fuchsia-300/35',
      iconLight: 'text-fuchsia-700',
      iconDark: 'text-fuchsia-200',
      glow: 'shadow-[0_18px_45px_-25px_rgba(217,70,239,0.62)]',
    },
  },
]

const featureHighlights: FeatureHighlight[] = [
  {
    icon: ShieldCheck,
    title: 'Secure',
    body: 'Bank-grade encryption and limited access.',
    palette: {
      gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
      ring: 'ring-sky-300/35',
      iconLight: 'text-sky-700',
      iconDark: 'text-sky-100',
      glow: 'shadow-[0_16px_40px_-24px_rgba(14,165,233,0.55)]',
    },
  },
  {
    icon: Zap,
    title: 'Fast',
    body: 'All accounts synced in a snap.',
    palette: {
      gradient: 'from-amber-400/55 via-amber-500/25 to-amber-500/5',
      ring: 'ring-amber-300/35',
      iconLight: 'text-amber-700',
      iconDark: 'text-amber-100',
      glow: 'shadow-[0_16px_40px_-24px_rgba(245,158,11,0.55)]',
    },
  },
  {
    icon: Landmark,
    title: '11k+ banks',
    body: 'Covering major institutions and credit unions.',
    palette: {
      gradient: 'from-emerald-400/55 via-emerald-500/25 to-emerald-500/5',
      ring: 'ring-emerald-300/35',
      iconLight: 'text-emerald-700',
      iconDark: 'text-emerald-100',
      glow: 'shadow-[0_16px_40px_-24px_rgba(16,185,129,0.55)]',
    },
  },
]

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
  return (
    <div className="grid gap-8 items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="flex flex-col space-y-8">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#34d399]/20 dark:bg-[#34d399]/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-[#10b981] dark:text-[#34d399] transition-colors duration-300 ease-out">
            Plaid Secure Link
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-[#0f172a] dark:text-white md:text-[2.6rem] transition-colors duration-300 ease-out">
              Connect your Accounts
            </h1>
            <p className="text-base leading-relaxed text-[#475569] dark:text-[#cbd5e1] transition-colors duration-300 ease-out">
              Securely link accounts to unlock live dashboards and automated budgets. Plaid uses industry-standard encryption so your credentials remain private.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-[#f87171] bg-[#fef2f2] dark:bg-[#450a0a] p-4 text-sm shadow-sm animate-[shake_400ms_ease-out,errorPulse_400ms_ease-out] transition-colors duration-300 ease-out">
            <p className="font-semibold text-[#991b1b] dark:text-[#fca5a5]">Connection failed</p>
            <p className="mt-1 text-xs text-[#b91c1c] dark:text-[#f87171]">{error}</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {featureHighlights.map(({ icon: Icon, title, body, palette }, index) => (
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
              <h4 className="mt-3 text-sm font-semibold text-[#0f172a] dark:text-white transition-colors duration-300 ease-out">{title}</h4>
              <p className="mt-1 text-xs text-[#475569] dark:text-[#cbd5e1] transition-colors duration-300 ease-out">{body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex flex-col self-end">
        <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-[#475569] dark:text-[#cbd5e1] sm:mb-4 transition-colors duration-300 ease-out">
          <span>Why Plaid?</span>
          <span>Trusted by 12k+ apps</span>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
            {plaidHighlights.map(({ icon: Icon, title, body, palette }, index) => (
              <div
                key={title}
                className="group relative flex h-full items-start gap-4 overflow-hidden rounded-2xl border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#0f172a] p-4 text-[13px] shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:border-[#93c5fd] dark:hover:border-[#38bdf8]"
                style={{ animationDelay: `${150 + index * 50}ms` }}
              >
                <span
                  className={`relative inline-flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f8fafc] dark:bg-[#1e293b] ring-1 ring-inset ${palette.ring} ${palette.glow} transition-all duration-200 ease-out group-hover:scale-105`}
                  aria-hidden="true"
                >
                  <span className={`absolute inset-0 bg-gradient-to-br ${palette.gradient}`} />
                  <span className="absolute inset-[18%] rounded-full bg-slate-300/30 blur-[6px] opacity-50 dark:bg-black/20 transition-colors duration-300 ease-out" />
                  <Icon className={`relative h-5 w-5 ${palette.iconLight} dark:${palette.iconDark} transition-colors duration-300 ease-out`} strokeWidth={1.7} />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-[#0f172a] dark:text-white transition-colors duration-300 ease-out">{title}</p>
                  <p className="mt-1 text-[12px] text-[#475569] dark:text-[#cbd5e1] transition-colors duration-300 ease-out">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={error ? onRetry : onConnect}
            disabled={connectionInProgress || isConnected}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
              isConnected
                ? 'bg-[#10b981]'
                : 'bg-gradient-to-r from-[#0ea5e9] to-[#a78bfa] hover:scale-[1.03] hover:shadow-[0_0_24px_rgba(14,165,233,0.4)] active:scale-[0.98] active:brightness-95'
            } ${
              connectionInProgress || isConnected ? 'opacity-100' : ''
            } focus-visible:ring-[#0ea5e9] focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900`}
          >
            {isConnected ? (
              <span className="flex items-center gap-2 animate-[successFlash_400ms_ease-out]">
                <span className="text-xl animate-[fadeSlideUp_400ms_ease-out]">✓</span>
                Connected
              </span>
            ) : connectionInProgress ? (
              <span className="flex items-center gap-2">
                <span className="inline-flex h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
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
  )
}
