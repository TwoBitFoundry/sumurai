import React from 'react'
import type { FinancialProvider } from '@/types/api'
import type { ConnectAccountProviderContent } from '@/utils/providerCards'

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
