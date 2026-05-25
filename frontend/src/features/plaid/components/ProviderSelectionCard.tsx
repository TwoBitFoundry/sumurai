import useViewportBreakpoint from '@/hooks/useViewportBreakpoint';
import type { FinancialProvider } from '@/types/api';
import type { ProviderCatalogue } from '@/types/providerCatalog';
import { Button, cn, GlassCard } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  status as uiStatusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { getConnectBlockedReason, isPickerEnabled } from '../../../utils/providerCapabilities';
import { getProviderCardConfig } from '../../../utils/providerCards';
import { ProviderSelectionSection } from './ProviderSelectionSection';

const privacyLinkClasses = cn(
  'inline-flex',
  'items-center',
  'underline',
  'underline-offset-4',
  uiTypographyRecipes.caption,
  uiTextRecipes.primary,
  'self-center',
  'transition-all',
  'duration-200',
  'hover:text-[var(--color-text-primary)]',
  'dark:hover:text-[var(--color-text-primary)]'
);

interface ProviderSelectionCardProps {
  provider: FinancialProvider;
  providerCatalogue: ProviderCatalogue;
  ready: boolean;
  connectingProvider: FinancialProvider | null;
  onSelectProvider: (provider: FinancialProvider) => void | Promise<void>;
}

export const ProviderSelectionCard = ({
  provider,
  providerCatalogue,
  ready,
  connectingProvider,
  onSelectProvider,
}: ProviderSelectionCardProps) => {
  const { isMobile } = useViewportBreakpoint();
  const details = getProviderCardConfig(provider);
  const enabled = isPickerEnabled(provider, providerCatalogue);
  const blockedReason = getConnectBlockedReason(provider, providerCatalogue);
  const privacyLinkLabel = `${details.title} privacy policy`;
  const isConnecting = connectingProvider === provider;
  const isAnyProviderConnecting = connectingProvider !== null;
  const requiresPreparedSdk = provider === 'teller';
  const isPrepared = !requiresPreparedSdk || ready;
  const disabled = !enabled || !isPrepared || isAnyProviderConnecting;
  const availabilityReason = !enabled
    ? blockedReason
    : !isPrepared
      ? 'Preparing secure connection'
      : null;

  return (
    <GlassCard
      variant="accent"
      rounded="lg"
      padding="none"
      withInnerEffects={false}
      containerClassName={cn(
        'h-full',
        'w-full',
        'lg:max-w-3xl',
        'mx-auto',
        'p-3',
        'sm:p-6',
        'transition-all',
        'duration-200',
        ...uiBorderRecipes.glass,
        ...uiSurfaceRecipes.card,
        'hover:shadow-[0_24px_80px_-50px_rgba(15,23,42,0.55)]',
        'dark:hover:border-[var(--color-border-hover-accent)]',
        'dark:hover:shadow-[0_28px_90px_-60px_rgba(2,6,23,0.7)]'
      )}
    >
      <div className={cn('flex', 'h-full', 'flex-col', 'gap-5')}>
        <div className={cn('flex', 'flex-col', 'gap-2')}>
          <div className={cn('flex', 'justify-start')}>
            <span
              className={cn(
                'rounded-full',
                ...uiStatusRecipes.info.surface,
                'px-3',
                'py-1',
                uiTypographyRecipes.label,
                ...uiStatusRecipes.info.text
              )}
            >
              {details.badge}
            </span>
          </div>
          <div
            className={cn(
              'grid',
              'grid-cols-[auto_minmax(0,1fr)]',
              'grid-rows-[auto_auto]',
              'items-start',
              'gap-x-3',
              'gap-y-1'
            )}
          >
            {details.logoSrc ? (
              <img
                src={details.logoSrc}
                alt={`${details.title} logo`}
                className={cn(
                  'row-span-2',
                  'h-12',
                  'w-12',
                  'self-center',
                  'rounded-full',
                  'object-cover'
                )}
              />
            ) : null}
            <div
              className={cn(
                'col-start-2',
                'row-start-1',
                uiTypographyRecipes.cardTitle,
                uiTextRecipes.primary
              )}
            >
              {details.title}
            </div>
            <p
              className={cn(
                'col-start-2',
                'row-start-2',
                uiTypographyRecipes.caption,
                uiTextRecipes.subtle
              )}
            >
              {details.region}
            </p>
          </div>
        </div>
        <div className={cn('space-y-3')}>
          {details.sections.map((section) => (
            <ProviderSelectionSection key={section.label} section={section} isMobile={isMobile} />
          ))}
        </div>
        <div className={cn('mt-auto', 'flex', 'w-full', 'flex-col', 'items-start', 'gap-3')}>
          <a
            href={details.privacyHref}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(privacyLinkClasses, 'self-start')}
            aria-label={privacyLinkLabel}
          >
            {privacyLinkLabel}
          </a>
          <div className={cn('w-full', 'space-y-2', 'text-left')}>
            <Button
              type="button"
              variant="connect"
              size="md"
              disabled={disabled}
              onClick={() => {
                void onSelectProvider(provider);
              }}
              className={cn('w-full', 'sm:w-auto', 'sm:min-w-40')}
            >
              {isConnecting ? 'Connecting…' : !isPrepared ? 'Loading…' : 'Connect'}
            </Button>
            {availabilityReason ? (
              <p className={cn('text-left', uiTypographyRecipes.caption, uiTextRecipes.subtle)}>
                {availabilityReason}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default ProviderSelectionCard;
