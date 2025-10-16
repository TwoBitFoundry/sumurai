import React from 'react'
import { Alert, Badge, Button, GlassCard } from '@/ui/primitives'
import { cn } from '@/ui/primitives/utils'
import type { ConnectAccountProviderContent } from '@/utils/providerCards'

type StatusTone = 'info' | 'warning' | 'error'

interface StatusMessage {
  tone: StatusTone
  text: string
  actionLabel?: string
  action?: () => void | Promise<void>
}

interface ConnectAccountStepProps {
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

const statusVariantMap: Record<StatusTone, 'info' | 'warning' | 'error'> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
}

function IconBurst({
  gradient,
  ring,
  glow,
  size = 'md',
  children,
}: {
  gradient: string
  ring: string
  glow: string
  size?: 'sm' | 'md'
  children: React.ReactNode
}) {
  const sizeClass = size === 'sm' ? 'h-11 w-11' : 'h-12 w-12'

  return (
    <span
      className={cn(
        'relative inline-flex',
        'items-center justify-center',
        'overflow-hidden rounded-full',
        sizeClass,
        'ring-1 ring-inset',
        'bg-slate-50',
        'dark:bg-slate-900',
        ring,
        glow
      )}
      aria-hidden="true"
    >
      <span className={cn('absolute inset-0', 'bg-gradient-to-br', gradient)} />
      <span className={cn('absolute inset-[18%]', 'rounded-full bg-slate-300/30', 'opacity-50', 'blur-[6px]', 'dark:bg-black/20')} />
      <span className={cn('relative flex', 'items-center justify-center')}>{children}</span>
    </span>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  palette,
}: ConnectAccountProviderContent['features'][number]) {
  return (
    <GlassCard
      variant="accent"
      rounded="lg"
      padding="md"
      className={cn('flex h-full flex-col', 'items-center gap-3', 'text-center')}
    >
      <IconBurst
        gradient={palette.gradient}
        ring={palette.ring}
        glow={palette.glow}
        size="sm"
      >
        <Icon className={cn('h-5 w-5', palette.iconLight, `dark:${palette.iconDark}`)} strokeWidth={1.7} />
      </IconBurst>
      <h4 className={cn('text-sm', 'font-semibold', 'text-slate-900', 'dark:text-white')}>{title}</h4>
      <p className={cn('text-xs', 'text-slate-600', 'dark:text-slate-300')}>{body}</p>
    </GlassCard>
  )
}

function HighlightCard({
  icon: Icon,
  title,
  body,
  palette,
}: ConnectAccountProviderContent['highlights'][number]) {
  return (
    <GlassCard
      variant="default"
      rounded="lg"
      padding="md"
      className={cn('flex', 'h-full', 'items-start', 'gap-4')}
    >
      <IconBurst
        gradient={palette.gradient}
        ring={palette.ring}
        glow={palette.glow}
      >
        <Icon className={cn('h-5 w-5', palette.iconLight, `dark:${palette.iconDark}`)} strokeWidth={1.7} />
      </IconBurst>
      <div className="space-y-1">
        <p className={cn('text-sm', 'font-semibold', 'text-slate-900', 'dark:text-white')}>{title}</p>
        <p className={cn('text-xs', 'text-slate-600', 'dark:text-slate-300')}>{body}</p>
      </div>
    </GlassCard>
  )
}

export function ConnectAccountStep({
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
    <div className={cn('grid', 'items-start', 'gap-8', 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]', 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]')}>
      <div className={cn('flex', 'flex-col', 'gap-8')}>
        <div className={cn('flex', 'flex-col', 'gap-5')}>
          <Badge
            variant="feature"
            size="sm"
            className={cn('tracking-[0.3em]', content.eyebrow.backgroundClassName, content.eyebrow.textClassName)}
          >
            {content.eyebrow.text}
          </Badge>
          <div className={cn('flex', 'flex-col', 'gap-3')}>
            <h1 className={cn('text-3xl', 'font-bold', 'text-slate-900', 'dark:text-white', 'md:text-[2.6rem]')}>
              {content.heroTitle}
            </h1>
            <p className={cn('text-base', 'leading-relaxed', 'text-slate-600', 'dark:text-slate-300')}>
              {content.heroDescription}
            </p>
          </div>
        </div>

        {statusMessages.length > 0 && (
          <div className={cn('flex', 'flex-col', 'gap-3')}>
            {statusMessages.map((status, index) => (
              <Alert
                key={`${status.tone}-${index}`}
                variant={statusVariantMap[status.tone]}
                tone="subtle"
                className={cn('flex', 'flex-col', 'gap-2')}
              >
                <p className="font-semibold">{status.text}</p>
                {status.action && status.actionLabel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => status.action?.()}
                    className={cn('self-start', 'px-3', 'py-1', 'text-xs')}
                  >
                    {status.actionLabel}
                  </Button>
                )}
              </Alert>
            ))}
          </div>
        )}

        {error && (
          <Alert variant="error" className={cn('flex', 'flex-col', 'gap-1')}>
            <p className="font-semibold">Connection failed</p>
            <p className="text-xs">{error}</p>
          </Alert>
        )}

        <div className={cn('grid', 'gap-3', 'sm:grid-cols-3')}>
          {content.features.map(feature => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>

      <div className={cn('flex', 'flex-col', 'gap-4')}>
        <div className={cn('flex', 'items-center', 'justify-between')}>
          <Badge
            variant="feature"
            size="sm"
            className={cn('tracking-[0.3em]', 'text-slate-600', 'dark:text-slate-300')}
          >
            {content.highlightLabel}
          </Badge>
          <span className={cn('text-xs', 'uppercase', 'tracking-[0.3em]', 'text-slate-500', 'dark:text-slate-300')}>
            {content.highlightMeta}
          </span>
        </div>
        <div className={cn('flex', 'flex-col', 'gap-4')}>
          <div className={cn('grid', 'auto-rows-fr', 'gap-3', 'sm:grid-cols-2')}>
            {content.highlights.map(highlight => (
              <HighlightCard key={highlight.title} {...highlight} />
            ))}
          </div>
          <Button
            variant={isConnected ? 'success' : 'connect'}
            size="lg"
            className="w-full"
            onClick={error ? onRetry : onConnect}
            disabled={connectionInProgress || isConnected || disablePrimaryAction}
          >
            {isConnected ? (
              <span className={cn('flex', 'items-center', 'gap-2')}>
                <span aria-hidden="true">✓</span>
                {institutionName ? `Connected to ${institutionName}` : 'Connected'}
              </span>
            ) : connectionInProgress ? (
              <span className={cn('flex', 'items-center', 'gap-2', 'text-sm')}>
                <span
                  className={cn(
                    'inline-flex h-4 w-4',
                    'rounded-full border-2',
                    'border-white border-t-transparent',
                    'animate-spin'
                  )}
                />
                Connecting…
              </span>
            ) : error ? (
              'Try again'
            ) : (
              <span className={cn('flex', 'items-center', 'gap-2')}>
                <span>{content.cta.defaultLabel}</span>
                {content.cta.badge && (
                  <Badge variant="default" size="xs" className="tracking-[0.2em]">
                    {content.cta.badge}
                  </Badge>
                )}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
