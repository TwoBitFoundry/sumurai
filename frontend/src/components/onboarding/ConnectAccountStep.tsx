import { Alert, Badge, Button } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import { designTokens } from '@/ui/tokens';
import type { ConnectAccountProviderContent } from '@/utils/providerCards';

type StatusTone = 'info' | 'warning' | 'error';

interface StatusMessage {
  tone: StatusTone;
  text: string;
  actionLabel?: string;
  action?: () => void | Promise<void>;
}

interface ConnectAccountStepProps {
  content: ConnectAccountProviderContent;
  providerLoading: boolean;
  providerError: string | null;
  onRetryProvider?: () => Promise<void> | void;
  tellerApplicationId?: string | null;
  isConnected: boolean;
  connectionInProgress: boolean;
  institutionName: string | null;
  error: string | null;
  onConnect: () => void;
  onRetry: () => void;
}

const statusVariantMap: Record<StatusTone, 'info' | 'warning' | 'error'> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
};

function FeatureCard({
  icon: Icon,
  title,
  palette,
}: ConnectAccountProviderContent['features'][number]) {
  return (
    <div className={cn(designTokens.components.onboarding.stepCard)}>
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-slate-200/60 via-slate-100/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-slate-700/40 dark:via-slate-800/20'
        )}
      />
      <span
        className={cn(
          designTokens.components.onboarding.iconWell,
          palette.ring,
          palette.glow,
          'transition-all duration-200 ease-out group-hover:scale-105'
        )}
        aria-hidden="true"
      >
        <span className={cn('absolute inset-0 bg-gradient-to-br', palette.gradient)} />
        <span
          className={cn(
            'absolute inset-[20%] rounded-full bg-slate-300/30 opacity-40 blur-[6px]',
            'dark:bg-black/20'
          )}
        />
        <Icon className={cn('relative h-5 w-5', palette.icon)} strokeWidth={1.7} />
      </span>
      <h4 className={cn(designTokens.components.onboarding.titleStrong)}>{title}</h4>
    </div>
  );
}

function HighlightCard({
  icon: Icon,
  title,
  body,
  palette,
}: ConnectAccountProviderContent['highlights'][number]) {
  return (
    <div className={cn(designTokens.components.onboarding.providerRow)}>
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-slate-200/60 via-slate-100/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:from-slate-700/40 dark:via-slate-800/20'
        )}
      />
      <span
        className={cn(
          designTokens.components.onboarding.iconWellLarge,
          palette.ring,
          palette.glow,
          'transition-all duration-200 ease-out group-hover:scale-105'
        )}
        aria-hidden="true"
      >
        <span className={cn('absolute inset-0 bg-gradient-to-br', palette.gradient)} />
        <span
          className={cn(
            'absolute inset-[18%] rounded-full bg-slate-300/30 opacity-50 blur-[6px]',
            'dark:bg-black/20'
          )}
        />
        <Icon
          className={cn('relative h-5 w-5', palette.iconLight, `dark:${palette.iconDark}`)}
          strokeWidth={1.7}
        />
      </span>
      <div className="relative z-10 space-y-1">
        <p className={cn(designTokens.components.onboarding.titleStrongInline)}>{title}</p>
        <p className={cn(designTokens.components.onboarding.rowBodyMuted)}>{body}</p>
      </div>
    </div>
  );
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
  const statusMessages: StatusMessage[] = [];

  if (providerLoading) {
    statusMessages.push({
      tone: 'info',
      text: 'Loading provider configuration…',
    });
  }

  if (providerError) {
    statusMessages.push({
      tone: 'error',
      text: providerError,
      actionLabel: 'Retry',
      action: onRetryProvider,
    });
  }

  const requiresApplicationId = Boolean(content.requiresApplicationId);
  const missingApplicationId = requiresApplicationId && !tellerApplicationId;

  if (missingApplicationId) {
    statusMessages.push({
      tone: 'warning',
      text:
        content.applicationIdMissingCopy ??
        'Add your Teller application ID in provider settings to continue.',
    });
  }

  const disablePrimaryAction = providerLoading || missingApplicationId;

  return (
    <div
      className={cn(
        'grid items-stretch gap-8',
        'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]',
        'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]'
      )}
    >
      <div className={cn('flex flex-col gap-8')}>
        <div className={cn('flex flex-col gap-5')}>
          <Badge
            variant="feature"
            size="sm"
            className={cn(
              'w-fit tracking-[0.3em]',
              content.eyebrow.backgroundClassName,
              content.eyebrow.textClassName
            )}
          >
            {content.eyebrow.text}
          </Badge>
          <div className={cn('space-y-3')}>
            <h1
              className={cn(
                'text-3xl font-bold text-slate-900 transition-colors duration-300 ease-out dark:text-white md:text-[2.6rem]'
              )}
            >
              {content.heroTitle}
            </h1>
            <p
              className={cn(
                'text-base leading-relaxed text-slate-600 transition-colors duration-300 ease-out dark:text-slate-300'
              )}
            >
              {content.heroDescription}
            </p>
          </div>
        </div>

        {statusMessages.length > 0 && (
          <div className={cn('space-y-3')}>
            {statusMessages.map((status, index) => (
              <Alert
                key={`${status.tone}-${index}`}
                variant={statusVariantMap[status.tone]}
                className={cn('flex flex-col gap-2 rounded-2xl')}
              >
                <p className="font-semibold">{status.text}</p>
                {status.action && status.actionLabel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => status.action?.()}
                    className={cn('self-start rounded-full border px-3 py-1 text-xs font-semibold')}
                  >
                    {status.actionLabel}
                  </Button>
                )}
              </Alert>
            ))}
          </div>
        )}

        {error && (
          <Alert
            variant="error"
            className={cn(
              'flex flex-col gap-1 rounded-[1.6rem] border-2 border-red-200/70 bg-red-50/85 text-red-700 shadow-[0_24px_60px_-36px_rgba(248,113,113,0.45)]',
              'dark:border-red-500/45 dark:bg-red-900/25 dark:text-red-200'
            )}
          >
            <p className="font-semibold">Connection failed</p>
            <p className="text-xs">{error}</p>
          </Alert>
        )}

        <div className={cn('flex flex-col gap-4')}>
          <div className={cn(designTokens.components.onboarding.eyebrowCaps)}>{content.highlightLabel}</div>
          <div className={cn('grid gap-3 sm:grid-cols-3')}>
            {content.features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </div>

      <div className={cn('flex flex-col gap-5 self-start mt-[52px]')}>
        <div className={cn(designTokens.components.onboarding.eyebrowCaps)}>{content.highlightMeta}</div>
        <div className={cn('flex flex-col gap-4')}>
          <div className={cn('grid auto-rows-fr gap-3 sm:grid-cols-2')}>
            {content.highlights.map((highlight) => (
              <HighlightCard key={highlight.title} {...highlight} />
            ))}
          </div>
          <Button
            variant={isConnected ? 'success' : 'connect'}
            size="lg"
            className={cn('w-full px-6 py-3 text-base')}
            onClick={error ? onRetry : onConnect}
            disabled={connectionInProgress || isConnected || disablePrimaryAction}
          >
            {isConnected ? (
              <span className={cn('flex items-center gap-2 text-sm sm:text-base')}>
                <span aria-hidden="true">✓</span>
                {institutionName ? `Connected to ${institutionName}` : 'Connected'}
              </span>
            ) : connectionInProgress ? (
              <span className={cn('flex items-center gap-2 text-sm')}>
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
              <span className={cn('flex items-center gap-2 text-sm sm:text-base')}>
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
  );
}
