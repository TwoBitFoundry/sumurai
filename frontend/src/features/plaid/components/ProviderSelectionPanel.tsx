import { X } from 'lucide-react';
import type { ReactNode } from 'react';
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
  visibleProviders?: FinancialProvider[];
  footerContent?: ReactNode;
}

const panelClasses = cn(
  'relative',
  'overflow-hidden',
  uiRadiusRecipes.standard,
  'border',
  ...uiBorderRecipes.glass,
  ...uiSurfaceRecipes.glassPanel,
  'p-3',
  'sm:p-4',
  'md:p-8',
  'lg:py-10',
  'lg:px-6',
  ...uiEffectRecipes.glassDropShadow,
  ...uiEffectRecipes.glassBackdrop
);

export const ProviderSelectionPanel = ({
  loading,
  error,
  availableProviders,
  tellerApplicationId,
  providerReadyState,
  connectingProvider,
  onSelectProvider,
  onClose,
  visibleProviders,
  footerContent,
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
    <section className={panelClasses} data-testid="provider-selection-panel">
      {onClose ? (
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Close provider picker"
          onClick={onClose}
          className={cn(
            'absolute',
            'right-3',
            'top-3',
            'z-20',
            'sm:right-4',
            'sm:top-4',
            'md:right-8',
            'md:top-8'
          )}
        >
          <X aria-hidden />
        </IconButton>
      ) : null}
      <div className={cn('relative', 'z-10', 'flex', 'flex-col', 'gap-8')}>
        <div className={cn('w-full', 'max-w-4xl', 'space-y-3', 'text-left', onClose && 'pr-10')}>
          <h1
            className={cn(
              uiTypographyRecipes.pageTitle,
              uiTextRecipes.primary,
              'md:text-[2.25rem]'
            )}
          >
            Choose how you connect accounts
          </h1>
          <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body, 'max-w-3xl', 'text-left')}>
            Pick the provider that fits your household, budget, and privacy needs.
          </p>
        </div>

        <div className={cn('grid', 'gap-6', 'md:grid-cols-2', 'lg:grid-cols-3', 'lg:gap-4')}>
          {providersToRender.map((provider) => (
            <ProviderSelectionCard
              key={provider}
              provider={provider}
              providerCatalogue={providerCatalogue}
              ready={providerReadyState?.[provider] ?? true}
              connectingProvider={currentConnectingProvider}
              onSelectProvider={onSelectProvider}
            />
          ))}
        </div>

        {footerContent ? <div className={cn('flex', 'justify-end')}>{footerContent}</div> : null}
      </div>
    </section>
  );
};

export default ProviderSelectionPanel;
