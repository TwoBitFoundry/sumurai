import type { FinancialProvider } from '@/types/api';
import type { ProviderCatalogue } from '@/types/providerCatalog';
import { cn } from '@/ui/primitives';
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

const eyebrowChip = cn(
  'inline-flex items-center justify-center rounded-full px-4 py-1 uppercase tracking-[0.3em]',
  uiTypographyRecipes.label,
  ...uiStatusRecipes.info.surface,
  ...uiStatusRecipes.info.text
);

interface ProviderSelectionPanelProps {
  loading: boolean;
  error: string | null;
  selectedProvider: FinancialProvider | null;
  availableProviders: FinancialProvider[];
  tellerApplicationId?: string | null;
  selectingProvider: FinancialProvider | null;
  onSelectProvider: (provider: FinancialProvider) => void | Promise<void>;
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
  'lg:p-10',
  ...uiEffectRecipes.glassShadow,
  'backdrop-blur-[28px]'
);

export const ProviderSelectionPanel = ({
  loading,
  error,
  selectedProvider,
  availableProviders,
  tellerApplicationId,
  selectingProvider,
  onSelectProvider,
}: ProviderSelectionPanelProps) => {
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
          'backdrop-blur-[28px]'
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

  if (selectedProvider) {
    return null;
  }

  const providerCatalogue: ProviderCatalogue = {
    available_providers: availableProviders,
    default_provider: availableProviders[0] ?? 'plaid',
    user_provider: selectedProvider,
    teller_application_id: tellerApplicationId ?? undefined,
  };

  return (
    <section className={panelClasses} data-testid="provider-selection-panel">
      <div className={cn('relative', 'z-10', 'flex', 'flex-col', 'gap-8')}>
        <div className={cn('mx-auto', 'w-full', 'max-w-4xl', 'space-y-3', 'text-left')}>
          <span className={eyebrowChip}>Self-Hosted</span>
          <h1
            className={cn(
              uiTypographyRecipes.pageTitle,
              uiTextRecipes.primary,
              'md:text-[2.25rem]'
            )}
          >
            Choose how you connect accounts
          </h1>
          <p className={cn(uiTypographyRecipes.body, uiTextRecipes.body, 'mx-auto', 'max-w-3xl')}>
            Select the provider that best fits your location, budget, and privacy priorities.
          </p>
        </div>

        <div className={cn('grid', 'gap-6', 'md:grid-cols-2', 'lg:grid-cols-3')}>
          {PROVIDER_PRICE_ORDER.map((provider) => (
            <ProviderSelectionCard
              key={provider}
              provider={provider}
              providerCatalogue={providerCatalogue}
              selectingProvider={selectingProvider}
              onSelectProvider={onSelectProvider}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProviderSelectionPanel;
