import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Building2, Eye, Fingerprint, Landmark, Network, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import type { FinancialProvider } from '@/types/api'

type HighlightPalette = {
  gradient: string
  ring: string
  iconLight: string
  iconDark: string
  glow: string
}

type ProviderHighlight = {
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

type ProviderFeature = {
  icon: LucideIcon
  title: string
  body: string
  palette: FeaturePalette
}

export interface ConnectAccountProviderContent {
  displayName: string
  eyebrow: {
    text: string
    backgroundClassName: string
    textClassName: string
  }
  heroTitle: string
  heroDescription: string
  highlightLabel: string
  highlightMeta: string
  features: ProviderFeature[]
  highlights: ProviderHighlight[]
  cta: {
    defaultLabel: string
    badge?: string
  }
  securityNote: string
  requiresApplicationId?: boolean
  applicationIdMissingCopy?: string
}

const plaidContent: ConnectAccountProviderContent = {
  displayName: 'Plaid',
  eyebrow: {
    text: 'Plaid Secure Link',
    backgroundClassName: 'bg-[#34d399]/20 dark:bg-[#34d399]/20',
    textClassName: 'text-[#10b981] dark:text-[#34d399]',
  },
  heroTitle: 'Connect your Accounts',
  heroDescription:
    'Securely link accounts to unlock live dashboards and automated budgets. Plaid uses industry-standard encryption so your credentials remain private.',
  highlightLabel: 'Why Plaid?',
  highlightMeta: 'Trusted by 12k+ apps',
  features: [
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
  ],
  highlights: [
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
  ],
  cta: {
    defaultLabel: 'Connect with Plaid',
    badge: 'Secure',
  },
  securityNote:
    '🔒 Bank-level encryption keeps every credential private. Plaid only shares read-only data, so funds stay untouchable.',
}

const tellerContent: ConnectAccountProviderContent = {
  displayName: 'Teller',
  eyebrow: {
    text: 'Teller Connect',
    backgroundClassName: 'bg-[#38bdf8]/20 dark:bg-[#38bdf8]/15',
    textClassName: 'text-[#0284c7] dark:text-[#38bdf8]',
  },
  heroTitle: 'Connect with Teller',
  heroDescription:
    'Launch Teller Connect using your own API keys to sync accounts without handing off long-lived credentials. Keep full control while budgets stay real-time.',
  highlightLabel: 'Why Teller?',
  highlightMeta: 'Bring your own credentials',
  features: [
    {
      icon: ShieldCheck,
      title: 'Mutual TLS',
      body: 'Every session authenticates with mutual TLS so your API keys stay in your infrastructure.',
      palette: {
        gradient: 'from-emerald-400/55 via-emerald-500/25 to-emerald-500/5',
        ring: 'ring-emerald-300/35',
        iconLight: 'text-emerald-700',
        iconDark: 'text-emerald-100',
        glow: 'shadow-[0_16px_40px_-24px_rgba(16,185,129,0.55)]',
      },
    },
    {
      icon: Network,
      title: 'Direct connections',
      body: 'Connect straight to Teller-supported institutions with zero credential sharing.',
      palette: {
        gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
        ring: 'ring-sky-300/35',
        iconLight: 'text-sky-700',
        iconDark: 'text-sky-100',
        glow: 'shadow-[0_16px_40px_-24px_rgba(14,165,233,0.55)]',
      },
    },
    {
      icon: Sparkles,
      title: 'Developer-first',
      body: 'Predictable REST responses and real-time ledger balances keep automation simple.',
      palette: {
        gradient: 'from-purple-400/55 via-purple-500/25 to-purple-500/5',
        ring: 'ring-purple-300/35',
        iconLight: 'text-purple-700',
        iconDark: 'text-purple-100',
        glow: 'shadow-[0_16px_40px_-24px_rgba(168,85,247,0.55)]',
      },
    },
  ],
  highlights: [
    {
      icon: Building2,
      title: 'Bring your own keys',
      body: 'Operate with Teller application keys so you stay the owner of access and revocation.',
      palette: {
        gradient: 'from-emerald-400/55 via-emerald-500/25 to-emerald-500/5',
        ring: 'ring-emerald-300/35',
        iconLight: 'text-emerald-700',
        iconDark: 'text-emerald-100',
        glow: 'shadow-[0_18px_45px_-25px_rgba(16,185,129,0.55)]',
      },
    },
    {
      icon: Fingerprint,
      title: 'mTLS handshake',
      body: 'Mutual TLS validates every request—credentials never touch third-party systems.',
      palette: {
        gradient: 'from-teal-400/55 via-teal-500/25 to-teal-500/5',
        ring: 'ring-teal-300/35',
        iconLight: 'text-teal-700',
        iconDark: 'text-teal-100',
        glow: 'shadow-[0_18px_45px_-25px_rgba(13,148,136,0.55)]',
      },
    },
    {
      icon: Landmark,
      title: 'Real-time balances',
      body: 'Ledger and available balances are fetched on every sync so dashboards stay accurate.',
      palette: {
        gradient: 'from-sky-400/55 via-sky-500/25 to-sky-500/5',
        ring: 'ring-sky-300/35',
        iconLight: 'text-sky-700',
        iconDark: 'text-sky-200',
        glow: 'shadow-[0_18px_45px_-25px_rgba(14,165,233,0.6)]',
      },
    },
    {
      icon: Eye,
      title: 'Operational visibility',
      body: 'Detailed webhook events and logs keep every sync auditable.',
      palette: {
        gradient: 'from-violet-400/55 via-violet-500/25 to-violet-500/5',
        ring: 'ring-violet-300/35',
        iconLight: 'text-violet-700',
        iconDark: 'text-violet-200',
        glow: 'shadow-[0_18px_45px_-25px_rgba(139,92,246,0.6)]',
      },
    },
  ],
  cta: {
    defaultLabel: 'Launch Teller Connect',
    badge: 'mTLS',
  },
  securityNote:
    '🔒 Teller Connect uses mutual TLS so your API keys remain in your control. Connections stay read-only and can be revoked instantly.',
  requiresApplicationId: true,
  applicationIdMissingCopy:
    'Teller onboarding requires a Teller application ID. Add it in provider settings before connecting.',
}

export const CONNECT_ACCOUNT_PROVIDER_CONTENT: Record<
  FinancialProvider,
  ConnectAccountProviderContent
> = {
  plaid: plaidContent,
  teller: tellerContent,
}

type StatusTone = 'info' | 'warning' | 'error'

interface StatusMessage {
  tone: StatusTone
  text: string
  actionLabel?: string
  action?: () => void | Promise<void>
}

interface ConnectAccountStepProps {
  provider: FinancialProvider
  content: ConnectAccountProviderContent
  providerLoading: boolean
  providerError: string | null
  onRetryProvider?: () => Promise<void> | void
  tellerApplicationId?: string | null
  isConnected: boolean
  connectionInProgress: boolean
  institutionName: string | null
  error: string | null
  onConnect: () => void
  onRetry: () => void
}

const STATUS_TONE_STYLES: Record<
  StatusTone,
  { container: string; text: string; button: string }
> = {
  info: {
    container:
      'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8] dark:border-[#1e40af]/45 dark:bg-[#1e293b]/75 dark:text-[#93c5fd]',
    text: 'text-[#1d4ed8] dark:text-[#bfdbfe]',
    button:
      'border-[#1d4ed8]/30 text-[#1d4ed8] hover:bg-[#1d4ed8]/10 dark:border-[#93c5fd]/40 dark:text-[#93c5fd] dark:hover:bg-[#1e3a8a]/30',
  },
  warning: {
    container:
      'border-[#fcd34d] bg-[#fef9c3] text-[#92400e] dark:border-[#f59e0b]/45 dark:bg-[#422006]/70 dark:text-[#fcd34d]',
    text: 'text-[#92400e] dark:text-[#fde68a]',
    button:
      'border-[#f59e0b]/30 text-[#92400e] hover:bg-[#f59e0b]/10 dark:border-[#fbbf24]/40 dark:text-[#fcd34d] dark:hover:bg-[#f59e0b]/30',
  },
  error: {
    container:
      'border-[#fecdd3] bg-[#fef2f2] text-[#b91c1c] dark:border-[#b91c1c]/45 dark:bg-[#450a0a]/70 dark:text-[#fecdd3]',
    text: 'text-[#b91c1c] dark:text-[#fecdd3]',
    button:
      'border-[#dc2626]/30 text-[#b91c1c] hover:bg-[#dc2626]/10 dark:border-[#f87171]/45 dark:text-[#fca5a5] dark:hover:bg-[#991b1b]/40',
  },
}

export function ConnectAccountStep({
  provider,
  content,
  providerLoading,
  providerError,
  onRetryProvider,
  tellerApplicationId,
  isConnected,
  connectionInProgress,
  institutionName,
  error,
  onConnect,
  onRetry,
}: ConnectAccountStepProps) {
  const statusMessages: StatusMessage[] = []

  if (providerLoading) {
    statusMessages.push({
      tone: 'info',
      text: 'Loading provider configuration…',
    })
  }

  if (providerError) {
    statusMessages.push({
      tone: 'error',
      text: providerError,
      actionLabel: 'Retry',
      action: onRetryProvider,
    })
  }

  const requiresApplicationId = Boolean(content.requiresApplicationId)
  const missingApplicationId = requiresApplicationId && !tellerApplicationId

  if (missingApplicationId) {
    statusMessages.push({
      tone: 'warning',
      text:
        content.applicationIdMissingCopy ??
        'Add your Teller application ID in provider settings to continue.',
    })
  }

  const disablePrimaryAction = providerLoading || missingApplicationId

  return (
    <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="flex flex-col space-y-8">
        <div className="space-y-5">
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] transition-colors duration-300 ease-out ${content.eyebrow.backgroundClassName} ${content.eyebrow.textClassName}`}
          >
            {content.eyebrow.text}
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-[#0f172a] transition-colors duration-300 ease-out dark:text-white md:text-[2.6rem]">
              {content.heroTitle}
            </h1>
            <p className="text-base leading-relaxed text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
              {content.heroDescription}
            </p>
          </div>
        </div>

        {statusMessages.length > 0 && (
          <div className="space-y-3">
            {statusMessages.map((status, index) => {
              const styles = STATUS_TONE_STYLES[status.tone]
              return (
                <div
                  key={`${status.tone}-${index}`}
                  className={`rounded-2xl border p-4 text-sm shadow-sm transition-colors duration-300 ease-out ${styles.container}`}
                >
                  <p className={`font-semibold ${styles.text}`}>{status.text}</p>
                  {status.action && status.actionLabel && (
                    <button
                      onClick={() => status.action?.()}
                      className={`mt-3 inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 ease-out ${styles.button}`}
                    >
                      {status.actionLabel}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-[#f87171] bg-[#fef2f2] p-4 text-sm shadow-sm transition-colors duration-300 ease-out animate-[shake_400ms_ease-out,errorPulse_400ms_ease-out] dark:bg-[#450a0a]">
            <p className="font-semibold text-[#991b1b] dark:text-[#fca5a5]">Connection failed</p>
            <p className="mt-1 text-xs text-[#b91c1c] dark:text-[#f87171]">{error}</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {content.features.map(({ icon: Icon, title, body, palette }, index) => (
            <div
              key={title}
              className="group flex h-full flex-col items-center justify-start rounded-xl border border-[#e2e8f0] bg-white px-4 py-4 text-center shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:border-[#93c5fd] dark:border-[#334155] dark:bg-[#0f172a] dark:hover:border-[#38bdf8]"
              style={{ animationDelay: `${150 + index * 50}ms` }}
            >
              <span
                className={`relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#f8fafc] ring-1 ring-inset ${palette.ring} ${palette.glow} transition-all duration-200 ease-out group-hover:scale-105 dark:bg-[#1e293b]`}
                aria-hidden="true"
              >
                <span className={`absolute inset-0 bg-gradient-to-br ${palette.gradient}`} />
                <span className="absolute inset-[20%] rounded-full bg-slate-300/30 opacity-40 blur-[6px] transition-colors duration-300 ease-out dark:bg-black/20" />
                <Icon
                  className={`relative h-5 w-5 ${palette.iconLight} transition-colors duration-300 ease-out dark:${palette.iconDark}`}
                  strokeWidth={1.7}
                />
              </span>
              <h4 className="mt-3 text-sm font-semibold text-[#0f172a] transition-colors duration-300 ease-out dark:text-white">
                {title}
              </h4>
              <p className="mt-1 text-xs text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex flex-col self-end">
        <div className="mb-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1] sm:mb-4">
          <span>{content.highlightLabel}</span>
          <span>{content.highlightMeta}</span>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
            {content.highlights.map(({ icon: Icon, title, body, palette }, index) => (
              <div
                key={title}
                className="group relative flex h-full items-start gap-4 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-4 text-[13px] shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:border-[#93c5fd] dark:border-[#334155] dark:bg-[#0f172a] dark:hover:border-[#38bdf8]"
                style={{ animationDelay: `${150 + index * 50}ms` }}
              >
                <span
                  className={`relative inline-flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f8fafc] ring-1 ring-inset ${palette.ring} ${palette.glow} transition-all duration-200 ease-out group-hover:scale-105 dark:bg-[#1e293b]`}
                  aria-hidden="true"
                >
                  <span className={`absolute inset-0 bg-gradient-to-br ${palette.gradient}`} />
                  <span className="absolute inset-[18%] rounded-full bg-slate-300/30 opacity-50 blur-[6px] transition-colors duration-300 ease-out dark:bg-black/20" />
                  <Icon
                    className={`relative h-5 w-5 ${palette.iconLight} transition-colors duration-300 ease-out dark:${palette.iconDark}`}
                    strokeWidth={1.7}
                  />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-[#0f172a] transition-colors duration-300 ease-out dark:text-white">
                    {title}
                  </p>
                  <p className="mt-1 text-[12px] text-[#475569] transition-colors duration-300 ease-out dark:text-[#cbd5e1]">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={error ? onRetry : onConnect}
            disabled={connectionInProgress || isConnected || disablePrimaryAction}
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
                {institutionName ? `Connected to ${institutionName}` : 'Connected'}
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
                <span>{content.cta.defaultLabel}</span>
                {content.cta.badge && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
                    {content.cta.badge}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
