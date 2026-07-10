import { ArrowUpRight, Link } from 'lucide-react';
import type { CSSProperties } from 'react';
import CategoryInlinePill from '@/features/transactions/components/CategoryInlinePill';
import useViewportBreakpoint from '@/hooks/useViewportBreakpoint';
import type { FinancialProvider } from '@/types/api';
import type { ProviderCatalogue } from '@/types/providerCatalog';
import { Button, cn, GlassCard } from '@/ui/primitives';
import {
  chromeBar,
  dashboardCategoryCard,
  providerSelectionCard,
  border as uiBorderRecipes,
  status as uiStatusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';
import {
  getConnectBlockedReason,
  isCredentialsEnvUnavailable,
  isPickerEnabled,
} from '../../../utils/providerCapabilities';
import { getProviderCardConfig } from '../../../utils/providerCards';
import { ProviderSelectionSection } from './ProviderSelectionSection';

const providerBadgeAccentIndex = new Map<string, number>([['provider-badge', 0]]);

const providerCardHoverRingStyle = {
  boxShadow: `inset 0 0 0 2px ${heroAccents.azure.ringHex}`,
} as CSSProperties;

const privacyLinkClasses = cn(
  'inline-flex',
  'items-center',
  'gap-1',
  'underline',
  'underline-offset-4',
  uiTypographyRecipes.caption,
  uiTextRecipes.body,
  'self-center',
  'transition-all',
  'duration-200',
  'hover:text-[var(--color-text-primary)]'
);

const privacyLinkExternalIcon = cn('h-3.5', 'w-3.5', 'shrink-0');

interface ProviderSelectionCardProps {
  provider: FinancialProvider;
  providerCatalogue: ProviderCatalogue;
  ready: boolean;
  connectingProvider: FinancialProvider | null;
  onSelectProvider: (provider: FinancialProvider) => void | Promise<void>;
  isOnline?: boolean;
}

export const ProviderSelectionCard = ({
  provider,
  providerCatalogue,
  ready,
  connectingProvider,
  onSelectProvider,
  isOnline = true,
}: ProviderSelectionCardProps) => {
  const { isMobile } = useViewportBreakpoint();
  const details = getProviderCardConfig(provider);
  const LogoIcon = details.logoIcon;
  const enabled = isPickerEnabled(provider, providerCatalogue);
  const blockedReason = getConnectBlockedReason(provider, providerCatalogue);
  const credentialsUnavailable = isCredentialsEnvUnavailable(provider, providerCatalogue);
  const privacyLinkLabel = `${details.title} privacy policy`;
  const isConnecting = connectingProvider === provider;
  const isAnyProviderConnecting = connectingProvider !== null;
  const requiresPreparedSdk = false;
  const isPrepared = !requiresPreparedSdk || ready;
  const needsNetwork = provider !== 'diy';
  const offline = needsNetwork && !isOnline;
  const disabled =
    offline || !enabled || !isPrepared || isAnyProviderConnecting || credentialsUnavailable;
  const availabilityReason = offline
    ? 'No internet connection'
    : credentialsUnavailable
      ? null
      : !enabled
        ? blockedReason
        : !isPrepared
          ? 'Preparing secure connection'
          : null;
  const connectButtonLabel = isConnecting
    ? 'Connecting…'
    : offline
      ? 'Offline'
      : credentialsUnavailable
        ? 'Unavailable'
        : !isPrepared
          ? 'Loading…'
          : 'Link Account';
  const connectButtonHoverLabel =
    availabilityReason ?? (credentialsUnavailable ? blockedReason : null) ?? connectButtonLabel;

  return (
    <GlassCard
      variant="accent"
      rounded="lg"
      padding="none"
      withInnerEffects={false}
      beforeContent={
        <div
          aria-hidden
          className={cn(...dashboardCategoryCard.insetRing)}
          style={providerCardHoverRingStyle}
        />
      }
      containerClassName={cn(
        'group',
        'relative',
        'overflow-hidden',
        'h-full',
        'w-full',
        ...providerSelectionCard.shell,
        ...providerSelectionCard.padding
      )}
    >
      <div className={cn('flex', 'h-full', 'flex-col', 'gap-5')}>
        <div className={cn('flex', 'flex-col', 'gap-2')}>
          <CategoryInlinePill
            categoryKey="provider-badge"
            label={details.badge}
            accentIndexByName={providerBadgeAccentIndex}
          />
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
            ) : LogoIcon ? (
              <span
                className={cn(
                  'row-span-2',
                  chromeBar.square,
                  'inline-flex',
                  'shrink-0',
                  'items-center',
                  'justify-center',
                  'self-center',
                  'rounded-full',
                  ...uiBorderRecipes.subtle,
                  ...uiSurfaceRecipes.insetWell,
                  ...uiStatusRecipes.info.icon
                )}
                aria-hidden
              >
                <LogoIcon className={cn(chromeBar.glyph)} />
              </span>
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
        <div className={cn('mt-auto', 'flex', 'w-full', 'flex-col', 'items-center', 'gap-3')}>
          {details.privacyHref ? (
            <a
              href={details.privacyHref}
              target="_blank"
              rel="noreferrer noopener"
              className={privacyLinkClasses}
              aria-label={privacyLinkLabel}
            >
              {privacyLinkLabel}
              <ArrowUpRight aria-hidden className={privacyLinkExternalIcon} />
            </a>
          ) : (
            <span
              aria-hidden
              className={cn(privacyLinkClasses, 'invisible', 'pointer-events-none', 'select-none')}
            >
              {privacyLinkLabel}
              <ArrowUpRight aria-hidden className={privacyLinkExternalIcon} />
            </span>
          )}
          <div className={cn('flex', 'w-full', 'flex-col', 'items-center', 'gap-2')}>
            <Button
              type="button"
              variant="connect"
              size="md"
              title={connectButtonHoverLabel}
              disabled={disabled}
              onClick={() => {
                void onSelectProvider(provider);
              }}
              className={cn('w-auto', 'min-w-40')}
            >
              {isConnecting ? (
                connectButtonLabel
              ) : credentialsUnavailable ? (
                connectButtonLabel
              ) : !isPrepared ? (
                connectButtonLabel
              ) : (
                <>
                  <Link aria-hidden className={cn('h-4', 'w-4')} />
                  {connectButtonLabel}
                </>
              )}
            </Button>
            {availabilityReason ? (
              <p className={cn('text-center', uiTypographyRecipes.caption, uiTextRecipes.subtle)}>
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
