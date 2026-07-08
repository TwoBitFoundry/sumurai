import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { HeroSubtitleInfo } from '@/layouts/HeroSubtitleInfo';
import { pageLayoutRecipes } from '@/layouts/PageLayout';
import type { FinancialProvider } from '@/types/api';
import type { ProviderCatalogue } from '@/types/providerCatalog';
import { cn, IconButton } from '@/ui/primitives';
import {
  border as uiBorderRecipes,
  effect as uiEffectRecipes,
  radius as uiRadiusRecipes,
  status as uiStatusRecipes,
  surface as uiSurfaceRecipes,
  text as uiTextRecipes,
  font as uiTypographyRecipes,
} from '@/ui/recipes';
import { PROVIDER_PRICE_ORDER } from '../../../utils/providerCards';
import { ProviderSelectionCard } from './ProviderSelectionCard';

interface ProviderSelectionPanelProps {
  loading: boolean;
  error: string | null;
  availableProviders: FinancialProvider[];
  tellerApplicationId?: string | null;
  providerReadyState?: Partial<Record<FinancialProvider, boolean>>;
  connectingProvider?: FinancialProvider | null;
  onSelectProvider: (provider: FinancialProvider) => void | Promise<void>;
  onClose?: () => void;
  heroAction?: ReactNode;
  visibleProviders?: FinancialProvider[];
  footerContent?: ReactNode;
  isOnline?: boolean;
}

const providerPickerTitle = 'Choose how you connect accounts';
const providerPickerSubtitle =
  'Pick the provider that fits your household, budget, and privacy needs.';

const panelClasses = cn(
  'relative',
  'overflow-hidden',
  uiRadiusRecipes.standard,
  'border',
  ...uiBorderRecipes.glass,
  ...uiSurfaceRecipes.glassPanel,
  'p-3',
  'md:p-8',
  'lg:py-10',
  'lg:px-6',
  ...uiEffectRecipes.glassDropShadow,
  ...uiEffectRecipes.glassBackdrop
);

function ProviderSelectionHero({
  onClose,
  heroAction,
}: {
  onClose?: () => void;
  heroAction?: ReactNode;
}) {
  const heroTrailing =
    heroAction ??
    (onClose ? (
      <IconButton
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Close provider picker"
        onClick={onClose}
      >
        <X aria-hidden />
      </IconButton>
    ) : null);

  return (
    <section className={cn(...pageLayoutRecipes.shell)}>
      <div className={cn(pageLayoutRecipes.shellSurface)}>
        <div className={cn(pageLayoutRecipes.innerRing)} />
      </div>

      <div className={cn('relative', 'z-10', 'flex', 'flex-col', 'gap-5')}>
        <div
          className={cn(
            'flex',
            'flex-col',
            'gap-4',
            'md:flex-row',
            'md:items-start',
            'md:justify-between'
          )}
        >
          <div className={cn('min-w-0', 'max-w-2xl', 'space-y-3')}>
            <div className="space-y-2">
              <div className={cn(...pageLayoutRecipes.titleInlineHost)}>
                <h1 className={cn(pageLayoutRecipes.titleInlineHeading)}>{providerPickerTitle}</h1>{' '}
                <HeroSubtitleInfo
                  pageTitle={providerPickerTitle}
                  subtitle={providerPickerSubtitle}
                />
              </div>
            </div>
          </div>
          {heroTrailing ? (
            <div className={cn('shrink-0', 'self-end', 'md:self-auto')}>{heroTrailing}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export const ProviderSelectionPanel = ({
  loading,
  error,
  availableProviders,
  tellerApplicationId,
  providerReadyState,
  connectingProvider,
  onSelectProvider,
  onClose,
  heroAction,
  visibleProviders,
  footerContent,
  isOnline = true,
}: ProviderSelectionPanelProps) => {
  const currentConnectingProvider = connectingProvider ?? null;

  if (loading) {
    return (
      <section className={panelClasses} data-testid="provider-loading-panel">
        <div className={cn('p-12', 'text-center')}>
          <div className={cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.body)}>
            Loading provider catalogue…
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        className={cn(
          'relative',
          'overflow-hidden',
          uiRadiusRecipes.standard,
          'border',
          ...uiBorderRecipes.glass,
          ...uiStatusRecipes.danger.surface,
          'p-12',
          'text-center',
          ...uiEffectRecipes.dangerGlow,
          ...uiEffectRecipes.glassBackdrop
        )}
        data-testid="provider-error-panel"
      >
        <div className={cn(uiTypographyRecipes.bodyStrong, uiTextRecipes.danger)}>{error}</div>
        <div className={cn('mt-2', uiTypographyRecipes.caption, uiTextRecipes.danger)}>
          Please refresh or try again later.
        </div>
      </section>
    );
  }

  const providerCatalogue: ProviderCatalogue = {
    available_providers: availableProviders,
    user_provider: null,
    teller_application_id: tellerApplicationId ?? undefined,
  };
  const providersToRender = (visibleProviders ?? PROVIDER_PRICE_ORDER).filter((provider) =>
    PROVIDER_PRICE_ORDER.includes(provider)
  );

  return (
    <div
      className={cn('flex', 'flex-col', 'gap-6', 'md:gap-8')}
      data-testid="provider-selection-panel"
    >
      <ProviderSelectionHero onClose={onClose} heroAction={heroAction} />

      <div className={cn('w-full', 'min-w-0', 'max-w-full')}>
        <div
          className={cn(
            'grid',
            'grid-cols-1',
            'gap-6',
            'md:grid-cols-2',
            'lg:grid-cols-4',
            'md:gap-4'
          )}
        >
          {providersToRender.map((provider) => (
            <ProviderSelectionCard
              key={provider}
              provider={provider}
              providerCatalogue={providerCatalogue}
              ready={providerReadyState?.[provider] ?? true}
              connectingProvider={currentConnectingProvider}
              onSelectProvider={onSelectProvider}
              isOnline={isOnline}
            />
          ))}
        </div>

        {footerContent ? (
          <div className={cn('mt-6', 'flex', 'justify-end')}>{footerContent}</div>
        ) : null}
      </div>
    </div>
  );
};

export default ProviderSelectionPanel;
