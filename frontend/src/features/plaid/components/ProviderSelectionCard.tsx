import { Link } from 'lucide-react';
import type { CSSProperties } from 'react';
import CategoryInlinePill from '@/features/transactions/components/CategoryInlinePill';
import useViewportBreakpoint from '@/hooks/useViewportBreakpoint';
import type { FinancialProvider } from '@/types/api';
import type { ProviderCatalogue } from '@/types/providerCatalog';
import { Button, cn, GlassCard } from '@/ui/primitives';
import {
  chromeBar,
  dashboardCategoryCard,
  border as uiBorderRecipes,
  status as uiStatusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { heroAccents } from '@/ui/tokens';
import { getConnectBlockedReason, isPickerEnabled } from '../../../utils/providerCapabilities';
import { getProviderCardConfig } from '../../../utils/providerCards';
import { ProviderSelectionSection } from './ProviderSelectionSection';

const providerBadgeAccentIndex = new Map<string, number>([['provider-badge', 0]]);

const providerCardHoverRingStyle = {
  boxShadow: `inset 0 0 0 2px ${heroAccents.sky.ringHex}`,
} as CSSProperties;

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
  const LogoIcon = details.logoIcon;
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
        'lg:max-w-3xl',
        'mx-auto',
        'p-3',
        'sm:p-6',
        'transition-all',
        'duration-200',
        ...uiBorderRecipes.glass,
        ...uiSurfaceRecipes.card
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
            </a>
          ) : null}
          <div className={cn('flex', 'w-full', 'flex-col', 'items-center', 'gap-2')}>
            <Button
              type="button"
              variant="connect"
              size="md"
              disabled={disabled}
              onClick={() => {
                void onSelectProvider(provider);
              }}
              className={cn('w-auto', 'min-w-40')}
            >
              {isConnecting ? (
                'Connecting…'
              ) : !isPrepared ? (
                'Loading…'
              ) : (
                <>
                  <Link aria-hidden className={cn('h-4', 'w-4')} />
                  Link Account
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
