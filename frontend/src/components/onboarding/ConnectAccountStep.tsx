import { type FormEvent, useState } from 'react';
import { Alert, Badge, Button, Input } from '@/ui/primitives';
import { cn } from '@/ui/primitives/utils';
import {
  border as semanticBorders,
  effect as semanticEffects,
  surface as semanticSurfaces,
  effect as uiEffectRecipes,
  radius as uiRadiusRecipes,
  status as uiStatusRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
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
  connectBlockedReason?: string | null;
  isOnline: boolean;
  isConnected: boolean;
  connectionInProgress: boolean;
  institutionName: string | null;
  error: string | null;
  onConnect: () => void;
  onRetry: () => void;
  usesSetupToken?: boolean;
  onSubmitSetupToken?: (token: string) => void | Promise<void>;
}

const SIMPLEFIN_DEVELOPERS_URL = 'https://beta-bridge.simplefin.org/info/developers';

const statusVariantMap: Record<StatusTone, 'info' | 'warning' | 'error'> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
};

const onboardingStepCard = [
  `relative overflow-hidden ${uiRadiusRecipes.standard} p-4`,
  ...semanticBorders.subtle,
  ...semanticSurfaces.card,
  ...semanticEffects.glassShadow,
] as const;

const onboardingIconWell = [
  'relative z-10 inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full',
  ...semanticSurfaces.insetWell,
  'ring-1 ring-inset',
] as const;

const onboardingIconGlow =
  'absolute inset-[20%] rounded-full bg-[var(--color-effect-accent-hover)] opacity-20 blur-[6px] dark:bg-[var(--color-effect-accent-hover)] dark:opacity-[0.18]';

const onboardingTitleStrong = [
  'relative z-10 mt-3',
  uiTypographyRecipes.bodyStrong,
  'dark:text-white',
] as const;
const onboardingTitleStrongInline = [uiTypographyRecipes.bodyStrong, 'dark:text-white'] as const;
const onboardingRowBodyMuted = [uiTypographyRecipes.caption, uiTextRecipes.body] as const;
const onboardingEyebrowCaps = [
  uiTypographyRecipes.label,
  'uppercase transition-colors duration-300 ease-out',
] as const;
const onboardingProviderRow = [
  'relative overflow-hidden',
  ...semanticBorders.subtle,
  ...semanticSurfaces.card,
  ...semanticEffects.glassShadow,
  `flex h-full items-start gap-4 ${uiRadiusRecipes.standard} p-4 text-[13px]`,
] as const;
const onboardingProviderIconGlow =
  'absolute inset-[18%] rounded-full bg-[var(--color-effect-accent-hover)] opacity-[0.22] blur-[6px] dark:bg-[var(--color-effect-accent-hover)] dark:opacity-[0.18]';

function FeatureCard({
  icon: Icon,
  title,
  palette,
}: ConnectAccountProviderContent['features'][number]) {
  return (
    <div className={cn(onboardingStepCard)}>
      <span className={cn(onboardingIconWell, palette.ring, palette.glow)} aria-hidden="true">
        <span className={cn('absolute inset-0 bg-gradient-to-br', palette.gradient)} />
        <span className={cn(onboardingIconGlow)} />
        <Icon className={cn('relative h-5 w-5', palette.icon)} strokeWidth={1.7} />
      </span>
      <h4 className={cn(onboardingTitleStrong)}>{title}</h4>
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
    <div className={cn(onboardingProviderRow)}>
      <span
        className={cn(
          'relative z-10 inline-flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full',
          ...semanticSurfaces.insetWell,
          'ring-1 ring-inset',
          palette.ring,
          palette.glow
        )}
        aria-hidden="true"
      >
        <span className={cn('absolute inset-0 bg-gradient-to-br', palette.gradient)} />
        <span className={cn(onboardingProviderIconGlow)} />
        <Icon
          className={cn('relative h-5 w-5', palette.iconLight, `dark:${palette.iconDark}`)}
          strokeWidth={1.7}
        />
      </span>
      <div className="relative z-10 space-y-1">
        <p className={cn(onboardingTitleStrongInline)}>{title}</p>
        <p className={cn(onboardingRowBodyMuted)}>{body}</p>
      </div>
    </div>
  );
}

export function ConnectAccountStep({
  content,
  providerLoading,
  providerError,
  onRetryProvider,
  connectBlockedReason,
  isOnline,
  isConnected,
  connectionInProgress,
  institutionName,
  error,
  onConnect,
  onRetry,
  usesSetupToken = false,
  onSubmitSetupToken,
}: ConnectAccountStepProps) {
  const [setupToken, setSetupToken] = useState('');
  const [setupTokenValidationError, setSetupTokenValidationError] = useState<string | null>(null);
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

  if (connectBlockedReason) {
    statusMessages.push({
      tone: 'warning',
      text: connectBlockedReason,
    });
  }

  if (!isOnline) {
    statusMessages.push({
      tone: 'warning',
      text: 'Unavailable while offline. Connect and sync are disabled until you are back online.',
    });
  }

  const disablePrimaryAction = providerLoading || Boolean(connectBlockedReason) || !isOnline;

  const handleSetupTokenSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = setupToken.trim();
    if (!trimmed) {
      setSetupTokenValidationError('Enter a SimpleFIN setup token.');
      return;
    }
    setSetupTokenValidationError(null);
    void onSubmitSetupToken?.(trimmed);
  };

  const displayError = setupTokenValidationError ?? error;

  return (
    <div
      className={cn(
        'grid items-stretch gap-8',
        'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]',
        'md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]'
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
                uiTypographyRecipes.pageTitle,
                uiTextRecipes.primary,
                'transition-colors',
                'duration-300',
                'ease-out'
              )}
            >
              {content.heroTitle}
            </h1>
            <p
              className={cn(
                uiTypographyRecipes.body,
                'leading-relaxed',
                uiTextRecipes.body,
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
                className={cn('flex flex-col gap-2', uiRadiusRecipes.standard)}
              >
                <p className={cn(uiTypographyRecipes.bodyStrong)}>{status.text}</p>
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

        {displayError && (
          <Alert
            variant="error"
            className={cn(
              'flex flex-col gap-1 rounded-[1.6rem] border-2',
              ...uiStatusRecipes.danger.border,
              ...uiStatusRecipes.danger.surface,
              ...uiStatusRecipes.danger.text,
              ...uiEffectRecipes.dangerGlow
            )}
          >
            <p className={cn(uiTypographyRecipes.bodyStrong)}>Connection failed</p>
            <p className={cn(uiTypographyRecipes.caption)}>{displayError}</p>
          </Alert>
        )}

        <div className={cn('flex flex-col gap-4')}>
          <div className={cn(onboardingEyebrowCaps)}>{content.highlightLabel}</div>
          <div className={cn('grid gap-3 md:grid-cols-3')}>
            {content.features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </div>

      <div className={cn('flex flex-col gap-5 self-start mt-[52px]')}>
        <div className={cn(onboardingEyebrowCaps)}>{content.highlightMeta}</div>
        <div className={cn('flex flex-col gap-4')}>
          <div className={cn('grid auto-rows-fr gap-3 md:grid-cols-2')}>
            {content.highlights.map((highlight) => (
              <HighlightCard key={highlight.title} {...highlight} />
            ))}
          </div>
          {usesSetupToken && !isConnected ? (
            <form className={cn('flex flex-col gap-4')} onSubmit={handleSetupTokenSubmit}>
              <div className={cn('space-y-2')}>
                <label htmlFor="simplefin-setup-token" className={cn(uiTypographyRecipes.label)}>
                  SimpleFIN setup token
                </label>
                <Input
                  id="simplefin-setup-token"
                  type="password"
                  autoComplete="off"
                  placeholder="Paste your SimpleFIN setup token"
                  value={setupToken}
                  onChange={(event) => {
                    setSetupToken(event.target.value);
                    if (setupTokenValidationError) {
                      setSetupTokenValidationError(null);
                    }
                  }}
                  disabled={connectionInProgress || disablePrimaryAction}
                  variant={setupTokenValidationError ? 'invalid' : 'default'}
                  inputSize="lg"
                />
                <p className={cn(uiTypographyRecipes.caption, uiTextRecipes.body)}>
                  Get a setup token from the{' '}
                  <a
                    href={SIMPLEFIN_DEVELOPERS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(uiTextRecipes.accent, 'underline underline-offset-2')}
                  >
                    SimpleFIN developer bridge
                  </a>
                  . The token links every institution you authorize there.
                </p>
              </div>
              <Button
                type="submit"
                variant="connect"
                size="lg"
                className={cn('w-full px-6 py-3')}
                disabled={connectionInProgress || disablePrimaryAction}
              >
                {connectionInProgress ? (
                  <span className={cn('flex items-center gap-2', uiTypographyRecipes.bodyStrong)}>
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
                ) : (
                  <span className={cn('flex items-center gap-2', uiTypographyRecipes.bodyStrong)}>
                    <span>Connect with {content.displayName}</span>
                    {content.cta.badge && (
                      <Badge variant="default" size="sm" className="tracking-[0.2em]">
                        {content.cta.badge}
                      </Badge>
                    )}
                  </span>
                )}
              </Button>
            </form>
          ) : (
            <Button
              variant={isConnected ? 'success' : 'connect'}
              size="lg"
              className={cn('w-full px-6 py-3')}
              onClick={displayError && isOnline ? onRetry : onConnect}
              disabled={connectionInProgress || isConnected || disablePrimaryAction}
            >
              {isConnected ? (
                <span className={cn('flex items-center gap-2', uiTypographyRecipes.bodyStrong)}>
                  <span aria-hidden="true">✓</span>
                  {institutionName ? `Connected to ${institutionName}` : 'Connected'}
                </span>
              ) : connectionInProgress ? (
                <span className={cn('flex items-center gap-2', uiTypographyRecipes.bodyStrong)}>
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
              ) : displayError ? (
                'Try again'
              ) : (
                <span className={cn('flex items-center gap-2', uiTypographyRecipes.bodyStrong)}>
                  {content.logoSrc ? (
                    <img
                      src={content.logoSrc}
                      alt={`${content.displayName} logo`}
                      className={cn('h-5', 'w-5', 'rounded-full', 'object-cover')}
                    />
                  ) : null}
                  <span>{content.cta.defaultLabel}</span>
                  {content.cta.badge && (
                    <Badge variant="default" size="sm" className="tracking-[0.2em]">
                      {content.cta.badge}
                    </Badge>
                  )}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
