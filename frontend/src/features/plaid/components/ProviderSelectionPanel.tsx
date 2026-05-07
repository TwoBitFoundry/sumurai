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
  'border-white/35',
  'bg-white/24',
  'p-10',
  'shadow-[0_32px_110px_-60px_rgba(15,23,42,0.75)]',
  'backdrop-blur-[28px]',
  'dark:border-white/12',
  ...designTokens.surfaces.glass.panelDark,
  ...designTokens.surfaces.glass.panelShadow
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
          <div className={cn('text-sm', 'font-medium', 'text-slate-600', 'dark:text-slate-300')}>
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
          'border-red-200/70',
          'bg-red-50/80',
          'p-12',
          'text-center',
          'shadow-[0_32px_110px_-60px_rgba(220,38,38,0.45)]',
          'backdrop-blur-[28px]',
          'dark:border-red-700/60',
          'dark:bg-red-900/25'
        )}
        data-testid="provider-error-panel"
      >
        <div className={cn('text-sm', 'font-semibold', 'text-red-600', 'dark:text-red-300')}>
          {error}
        </div>
        <div className={cn('mt-2', 'text-xs', 'text-red-500', 'dark:text-red-200')}>
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
              'text-3xl',
              'font-bold',
              'text-slate-900',
              'dark:text-white',
              'sm:text-4xl'
            )}
          >
            Choose how you connect accounts
          </h1>
          <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>
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
                    'border-white/45',
                    'bg-white/80',
                    'dark:border-white/10',
                    'dark:bg-[#111a2f]/70',
                    'hover:shadow-[0_24px_80px_-50px_rgba(15,23,42,0.55)]',
                    'dark:hover:border-sky-400/40',
                    'dark:hover:shadow-[0_28px_90px_-60px_rgba(2,6,23,0.7)]'
                  )}
                >
                  <div className={cn('flex', 'h-full', 'flex-col', 'gap-4')}>
                    <div className={cn('flex', 'items-center', 'justify-between')}>
                      <div
                        className={cn(
                          'text-lg',
                          'font-semibold',
                          'text-slate-900',
                          'dark:text-white'
                        )}
                      >
                        {details.title}
                      </div>
                      <span
                        className={cn(
                          'rounded-full',
                          'bg-sky-100',
                          'px-3',
                          'py-1',
                          'text-[10px]',
                          'font-semibold',
                          'uppercase',
                          'tracking-[0.28em]',
                          'text-sky-700',
                          'dark:bg-sky-500/15',
                          'dark:text-sky-200'
                        )}
                      >
                        {details.badge}
                      </span>
                    </div>
                    <p className={cn('text-sm', 'text-slate-600', 'dark:text-slate-300')}>
                      {details.description}
                    </p>
                    <ul
                      className={cn(
                        'space-y-2',
                        'text-sm',
                        'text-slate-500',
                        'dark:text-slate-400'
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
                              'bg-sky-400',
                              'dark:bg-sky-500'
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
                        'bg-sky-500',
                        'px-4',
                        'py-2',
                        'text-sm',
                        'font-semibold',
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
