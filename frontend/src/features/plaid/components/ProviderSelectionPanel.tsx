import type { FinancialProvider } from '@/types/api';
import { cn, GlassCard } from '@/ui/primitives';
import { designTokens } from '@/ui/tokens';
import { getProviderCardConfig } from '../../../utils/providerCards';

interface ProviderSelectionPanelProps {
  loading: boolean;
  error: string | null;
  selectedProvider: FinancialProvider | null;
  availableProviders: FinancialProvider[];
  selectingProvider: FinancialProvider | null;
  onSelectProvider: (provider: FinancialProvider) => void | Promise<void>;
}

const panelClasses = cn(
  'relative',
  'overflow-hidden',
  'rounded-[2.25rem]',
  'border',
  ...designTokens.borders.glass,
  ...designTokens.surfaces.semantic.glassPanel,
  'p-10',
  ...designTokens.effects.semantic.glassShadow,
  'backdrop-blur-[28px]'
);

export const ProviderSelectionPanel = ({
  loading,
  error,
  selectedProvider,
  availableProviders,
  selectingProvider,
  onSelectProvider,
}: ProviderSelectionPanelProps) => {
  if (loading) {
    return (
      <section className={panelClasses} data-testid="provider-loading-panel">
        <div className={cn('p-12', 'text-center')}>
          <div className={cn(designTokens.typography.bodyStrong, designTokens.text.body)}>
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
          'rounded-[2.25rem]',
          'border',
          ...designTokens.status.danger.border,
          ...designTokens.status.danger.surface,
          'p-12',
          'text-center',
          ...designTokens.effects.semantic.dangerGlow,
          'backdrop-blur-[28px]'
        )}
        data-testid="provider-error-panel"
      >
        <div className={cn(designTokens.typography.bodyStrong, designTokens.text.danger)}>
          {error}
        </div>
        <div className={cn('mt-2', designTokens.typography.caption, designTokens.text.danger)}>
          Please refresh or try again later.
        </div>
      </section>
    );
  }

  if (selectedProvider) {
    return null;
  }

  return (
    <section className={panelClasses} data-testid="provider-selection-panel">
      <div className={cn('relative', 'z-10', 'flex', 'flex-col', 'gap-8')}>
        <div className={cn('space-y-3', 'text-center')}>
          <span className={cn(designTokens.surfaces.layered.eyebrowChip)}>Select Provider</span>
          <h1
            className={cn(
              designTokens.typography.pageTitle,
              designTokens.text.primary,
              'sm:text-[2.25rem]'
            )}
          >
            Choose how you connect accounts
          </h1>
          <p className={cn(designTokens.typography.body, designTokens.text.body)}>
            Pick the data provider that matches your deployment. You can change this later from
            account settings.
          </p>
        </div>

        <div className={cn('grid', 'gap-6', 'lg:grid-cols-2')}>
          {availableProviders.map((provider) => {
            const details = getProviderCardConfig(provider);
            return (
              <button
                key={provider}
                type="button"
                onClick={() => {
                  void onSelectProvider(provider);
                }}
                disabled={selectingProvider === provider}
                className={cn(
                  'relative',
                  'flex',
                  'w-full',
                  'h-full',
                  'text-left',
                  'transition-transform',
                  'duration-200',
                  'hover:-translate-y-[2px]',
                  'focus:outline-none',
                  'focus-visible:ring-2',
                  'focus-visible:ring-sky-400/80',
                  'focus-visible:ring-offset-2',
                  'focus-visible:ring-offset-white',
                  'disabled:cursor-not-allowed',
                  'disabled:opacity-75',
                  'dark:focus-visible:ring-offset-slate-900'
                )}
              >
                <GlassCard
                  variant="accent"
                  rounded="lg"
                  padding="md"
                  withInnerEffects={false}
                  containerClassName={cn(
                    'h-full',
                    'w-full',
                    'transition-all',
                    'duration-200',
                    ...designTokens.borders.glass,
                    ...designTokens.surfaces.semantic.card,
                    'hover:shadow-[0_24px_80px_-50px_rgba(15,23,42,0.55)]',
                    'dark:hover:border-[var(--color-border-hover-accent-dark)]',
                    'dark:hover:shadow-[0_28px_90px_-60px_rgba(2,6,23,0.7)]'
                  )}
                >
                  <div className={cn('flex', 'h-full', 'flex-col', 'gap-4')}>
                    <div className={cn('flex', 'items-center', 'justify-between')}>
                      <div
                        className={cn(designTokens.typography.cardTitle, designTokens.text.primary)}
                      >
                        {details.title}
                      </div>
                      <span
                        className={cn(
                          'rounded-full',
                          ...designTokens.status.info.surface,
                          'px-3',
                          'py-1',
                          designTokens.typography.label,
                          ...designTokens.status.info.text
                        )}
                      >
                        {details.badge}
                      </span>
                    </div>
                    <p className={cn(designTokens.typography.body, designTokens.text.body)}>
                      {details.description}
                    </p>
                    <ul
                      className={cn(
                        'space-y-2',
                        designTokens.typography.body,
                        designTokens.text.subtle
                      )}
                    >
                      {details.bullets.map((bullet) => (
                        <li key={bullet} className={cn('flex', 'items-start', 'gap-2')}>
                          <span
                            className={cn(
                              'mt-[5px]',
                              'h-1.5',
                              'w-1.5',
                              'rounded-full',
                              'bg-[var(--color-brand-sky)]',
                              'dark:bg-[var(--color-brand-sky-dark)]'
                            )}
                          />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                    <div
                      className={cn(
                        'mt-auto',
                        'inline-flex',
                        'items-center',
                        'justify-center',
                        'rounded-full',
                        'bg-[var(--color-brand-sky)]',
                        'px-4',
                        'py-2',
                        designTokens.typography.bodyStrong,
                        'text-white',
                        'shadow-[0_18px_48px_-32px_rgba(14,165,233,0.65)]'
                      )}
                    >
                      {selectingProvider === provider ? 'Selecting…' : `Use ${details.title}`}
                    </div>
                  </div>
                </GlassCard>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProviderSelectionPanel;
