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
      <div className="flex h-full flex-col text-left">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
            Plaid Secure Link
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-[2.6rem] transition-colors duration-300">
              Connect your bank
            </h1>
            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400 transition-colors duration-300">
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

        <div className="mt-6 flex flex-1 flex-col gap-4 rounded-2xl border border-white/60 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-slate-800/50 dark:bg-slate-900/70 transition-colors duration-300">
          <div className="grid gap-3 items-start sm:grid-cols-3">
            {featureHighlights.map(({ icon: Icon, title, body, palette }) => (
              <div
                key={title}
                className="flex h-full flex-col items-center justify-start rounded-xl border border-slate-200/60 bg-white/90 px-4 py-4 text-center text-slate-700 shadow-[0_18px_42px_-26px_rgba(15,23,42,0.25)] backdrop-blur dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-300 dark:shadow-[0_18px_42px_-26px_rgba(15,23,42,0.85)] transition-colors duration-300"
              >
                <span
                  className={`relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ${palette.ring} ${palette.glow} dark:bg-slate-950/60 transition-colors duration-300`}
                  aria-hidden="true"
                >
                  <span className={`absolute inset-0 bg-gradient-to-br ${palette.gradient}`} />
                  <span className="absolute inset-[20%] rounded-full bg-slate-300/30 blur-[6px] opacity-40 dark:bg-black/20 transition-colors duration-300" />
                  <Icon className={`relative h-5 w-5 ${palette.iconLight} dark:${palette.iconDark} transition-colors duration-300`} strokeWidth={1.7} />
                </span>
                <h4 className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors duration-300">{title}</h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 transition-colors duration-300">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex flex-col self-start lg:mt-[2.45rem]">
        <div className="pointer-events-none absolute -top-6 right-0 h-24 w-24 rounded-full bg-blue-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-8 h-32 w-32 rounded-full bg-purple-400/20 blur-3xl" />

        <div className="relative z-10 flex flex-col rounded-2xl bg-white/80 p-6 shadow-2xl ring-1 ring-white/50 backdrop-blur dark:bg-slate-900/70 dark:ring-slate-800/50 transition-colors duration-300">
          <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 sm:mb-4">
            <span>Why Plaid?</span>
            <span>Trusted by 12k+ apps</span>
          </div>
          <div className="flex flex-col gap-4">
            <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
              {plaidHighlights.map(({ icon: Icon, title, body, palette }) => (
                <div
                  key={title}
                  className="group relative flex h-full items-start gap-4 overflow-hidden rounded-2xl border border-slate-200/40 bg-white/80 p-4 text-[13px] text-slate-700 shadow-[0_18px_46px_-28px_rgba(15,23,42,0.3)] transition-all duration-300 backdrop-blur-sm dark:border-white/5 dark:bg-slate-900/60 dark:text-slate-300 dark:shadow-[0_18px_46px_-28px_rgba(15,23,42,0.9)]"
                >
                  <span
                    className={`relative inline-flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ${palette.ring} ${palette.glow} transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_20px_46px_-28px_rgba(15,23,42,0.4)] dark:bg-slate-950/70 dark:group-hover:shadow-[0_20px_46px_-28px_rgba(15,23,42,0.95)]`}
                    aria-hidden="true"
                  >
                    <span className={`absolute inset-0 bg-gradient-to-br ${palette.gradient}`} />
                    <span className="absolute inset-[18%] rounded-full bg-slate-300/30 blur-[6px] opacity-50 dark:bg-black/20 transition-colors duration-300" />
                    <Icon className={`relative h-5 w-5 ${palette.iconLight} dark:${palette.iconDark} transition-colors duration-300`} strokeWidth={1.7} />
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 transition-colors duration-300">{title}</p>
                    <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-400 transition-colors duration-300">{body}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={error ? onRetry : onConnect}
              disabled={connectionInProgress || isConnected}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-6 py-3 text-base font-semibold text-white shadow-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-slate-900"
            >
              {isConnected ? (
                <span className="flex items-center gap-2">
                  <span className="text-xl">✓</span>
                  Connected
                </span>
              ) : connectionInProgress ? (
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
