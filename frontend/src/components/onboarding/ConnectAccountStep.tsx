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
      <div className={cn(designTokens.components.onboarding.hoverOverlay)} />
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
        <span className={cn(designTokens.components.onboarding.iconGlow)} />
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
      <div className={cn(designTokens.components.onboarding.providerHoverOverlay)} />
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
        <span className={cn(designTokens.components.onboarding.providerIconGlow)} />
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
                designTokens.typography.pageTitle,
                designTokens.text.primary,
                'transition-colors',
                'duration-300',
                'ease-out'
              )}
            >
              {content.heroTitle}
            </h1>
            <p
              className={cn(
                designTokens.typography.body,
                'leading-relaxed',
                designTokens.text.body,
                'transition-colors',
                'duration-300',
                'ease-out'
              )}
            >
              {content.heroDescription}
            </p>
          </div>
        </div>

        {statusMessages.length > 0 && (
          <div className={cn('space-y-3')}>
            {statusMessages.map((status) => (
              <Alert
                key={`${status.tone}-${status.text}`}
                variant={statusVariantMap[status.tone]}
                className={cn('flex flex-col gap-2 rounded-2xl')}
              >
                <p className={cn(designTokens.typography.bodyStrong)}>{status.text}</p>
                {status.action && status.actionLabel && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => status.action?.()}
                    className={cn('self-start rounded-full border px-3 py-1')}
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
              'flex flex-col gap-1 rounded-[1.6rem] border-2',
              ...designTokens.status.danger.border,
              ...designTokens.status.danger.surface,
              ...designTokens.status.danger.text,
              ...designTokens.effects.semantic.dangerGlow
            )}
          >
            <p className={cn(designTokens.typography.bodyStrong)}>Connection failed</p>
            <p className={cn(designTokens.typography.caption)}>{error}</p>
          </Alert>
        )}

        <div className={cn('flex flex-col gap-4')}>
          <div className={cn(designTokens.components.onboarding.eyebrowCaps)}>
            {content.highlightLabel}
          </div>
          <div className={cn('grid gap-3 sm:grid-cols-3')}>
            {content.features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </div>

      <div className={cn('flex flex-col gap-5 self-start mt-[52px]')}>
        <div className={cn(designTokens.components.onboarding.eyebrowCaps)}>
          {content.highlightMeta}
        </div>
        <div className={cn('flex flex-col gap-4')}>
          <div className={cn('grid auto-rows-fr gap-3 sm:grid-cols-2')}>
            {content.highlights.map((highlight) => (
              <HighlightCard key={highlight.title} {...highlight} />
            ))}
          </div>
          <Button
            variant={isConnected ? 'success' : 'connect'}
            size="lg"
            className={cn('w-full px-6 py-3')}
            onClick={error ? onRetry : onConnect}
            disabled={connectionInProgress || isConnected || disablePrimaryAction}
          >
            {isConnected ? (
              <span className={cn('flex items-center gap-2', designTokens.typography.bodyStrong)}>
                <span aria-hidden="true">✓</span>
                {institutionName ? `Connected to ${institutionName}` : 'Connected'}
              </span>
            ) : connectionInProgress ? (
              <span className={cn('flex items-center gap-2', designTokens.typography.bodyStrong)}>
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
              <span className={cn('flex items-center gap-2', designTokens.typography.bodyStrong)}>
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
