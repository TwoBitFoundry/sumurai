import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingProviderPicker } from '@/components/onboarding/OnboardingProviderPicker';
import { AuthService } from '@/services/authService';
import type { FinancialProvider } from '@/types/api';
import { ThemeTestProvider } from '../../utils/ThemeTestProvider';

const chooseProviderMock = jest.fn(
  async (_provider: 'plaid' | 'teller' | 'simplefin' | 'diy') => undefined
);
const plaidInitiateConnectionMock = jest.fn(async (_setupToken?: string) => undefined);

jest.mock('@/hooks/useProviderCatalog', () => {
  const React = require('react') as typeof import('react');

  return {
    useProviderCatalog: () => {
      const [userProvider, setUserProvider] = React.useState<FinancialProvider | null>(null);

      return {
        loading: false,
        error: null,
        availableProviders: ['simplefin', 'plaid', 'diy'],
        userProvider,
        isProviderAvailable: jest.fn(),
        canConnectWith: jest.fn(),
        getConnectBlockedReason: jest.fn(),
        resolveConnectProvider: jest.fn(),
        refresh: jest.fn(),
        chooseProvider: async (provider: FinancialProvider) => {
          setUserProvider(provider);
          return chooseProviderMock(provider);
        },
      };
    },
  };
});

jest.mock('@/hooks/useFinancialConnection', () => ({
  useFinancialConnection: ({ provider }: { provider: 'plaid' | 'teller' | 'simplefin' }) => ({
    isReady: true,
    isConnected: false,
    connectionInProgress: false,
    isSyncing: false,
    institutionName: null,
    error: null,
    initiateConnection: provider === 'plaid' ? plaidInitiateConnectionMock : jest.fn(),
    retryConnection: jest.fn(),
    reset: jest.fn(),
    setError: jest.fn(),
    connectionMount: <div data-testid={`${provider}-connection-mount`} />,
  }),
}));

jest.mock('@/features/diy/DiyInstitutionModal', () => ({
  DiyInstitutionModal: ({
    isOpen,
    onComplete,
  }: {
    isOpen: boolean;
    onComplete: (connectionId: string) => Promise<void> | void;
  }) =>
    isOpen ? (
      <div data-testid="diy-institution-modal">
        <button type="button" onClick={() => void onComplete('conn-diy')}>
          Complete DIY
        </button>
      </div>
    ) : null,
}));

jest.mock('@/components/onboarding/OnboardingProviderConnectModal', () => ({
  OnboardingProviderConnectModal: ({
    provider,
    isOpen,
    onClose,
    onConnected,
  }: {
    provider: 'plaid' | 'teller' | 'simplefin' | null;
    isOpen: boolean;
    onClose: () => void;
    onConnected: (provider: 'plaid' | 'teller' | 'simplefin') => Promise<void> | void;
  }) =>
    isOpen && provider ? (
      <div data-testid="provider-connect-modal">
        <div>{provider}</div>
        <button type="button" onClick={() => void onConnected(provider)}>
          Complete connect
        </button>
        <button type="button" onClick={onClose}>
          Close modal
        </button>
      </div>
    ) : null,
}));

jest.mock('@/features/plaid/components/ProviderSelectionPanel', () => ({
  ProviderSelectionPanel: ({
    onSelectProvider,
    heroAction,
  }: {
    onSelectProvider: (provider: 'plaid' | 'teller' | 'simplefin' | 'diy') => void;
    heroAction?: React.ReactNode;
  }) => (
    <div>
      {heroAction}
      <button type="button" onClick={() => onSelectProvider('simplefin')}>
        Pick SimpleFIN
      </button>
      <button type="button" onClick={() => onSelectProvider('plaid')}>
        Pick Plaid
      </button>
      <button type="button" onClick={() => onSelectProvider('diy')}>
        Pick DIY
      </button>
      <button type="button" onClick={() => onSelectProvider('teller')}>
        Pick Teller
      </button>
    </div>
  ),
}));

jest.mock('@/services/authService', () => ({
  AuthService: {
    completeOnboarding: jest.fn().mockResolvedValue({
      message: 'ok',
      onboarding_completed: true,
      demo_mode_active: false,
    }),
  },
}));

describe('OnboardingProviderPicker', () => {
  beforeEach(() => {
    chooseProviderMock.mockClear();
    plaidInitiateConnectionMock.mockClear();
    jest.mocked(AuthService.completeOnboarding).mockClear();
  });

  it('auto-completes onboarding when a provider connection succeeds', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();

    render(
      <ThemeTestProvider>
        <OnboardingProviderPicker onComplete={onComplete} />
      </ThemeTestProvider>
    );

    await user.click(screen.getByRole('button', { name: /pick simplefin/i }));
    await user.click(screen.getByRole('button', { name: /complete connect/i }));

    expect(chooseProviderMock).toHaveBeenCalledWith('simplefin');

    await waitFor(() => {
      expect(AuthService.completeOnboarding).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('does not expose demo mode after pricing', () => {
    render(
      <ThemeTestProvider>
        <OnboardingProviderPicker onComplete={jest.fn()} />
      </ThemeTestProvider>
    );

    expect(screen.queryByRole('button', { name: /try demo mode/i })).not.toBeInTheDocument();
  });

  it('dismisses the connect modal without leaving a selected state', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTestProvider>
        <OnboardingProviderPicker onComplete={jest.fn()} />
      </ThemeTestProvider>
    );

    await user.click(screen.getByRole('button', { name: /pick simplefin/i }));
    await user.click(screen.getByRole('button', { name: /close modal/i }));

    expect(screen.queryByTestId('provider-connect-modal')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pick simplefin/i })).toBeVisible();
  });

  it('ignores teller selection without starting a connect flow', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTestProvider>
        <OnboardingProviderPicker onComplete={jest.fn()} />
      </ThemeTestProvider>
    );

    await user.click(screen.getByRole('button', { name: /pick teller/i }));

    expect(plaidInitiateConnectionMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('provider-connect-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('teller-connection-mount')).not.toBeInTheDocument();
  });

  it('starts Plaid connect from the picker click', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTestProvider>
        <OnboardingProviderPicker onComplete={jest.fn()} />
      </ThemeTestProvider>
    );

    await user.click(screen.getByRole('button', { name: /pick plaid/i }));

    expect(plaidInitiateConnectionMock).toHaveBeenCalledTimes(1);
  });

  it('opens the DIY institution modal and completes onboarding', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();

    render(
      <ThemeTestProvider>
        <OnboardingProviderPicker onComplete={onComplete} />
      </ThemeTestProvider>
    );

    await user.click(screen.getByRole('button', { name: /pick diy/i }));
    expect(screen.getByTestId('diy-institution-modal')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /complete diy/i }));

    await waitFor(() => {
      expect(chooseProviderMock).toHaveBeenCalledWith('diy');
      expect(AuthService.completeOnboarding).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
