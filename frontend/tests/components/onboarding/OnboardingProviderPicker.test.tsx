import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingProviderPicker } from '@/components/onboarding/OnboardingProviderPicker';
import { AuthService } from '@/services/authService';
import { ThemeTestProvider } from '../../utils/ThemeTestProvider';

const chooseProviderMock = jest.fn(
  async (_provider: 'plaid' | 'teller' | 'simplefin') => undefined
);
const plaidInitiateConnectionMock = jest.fn(async (_setupToken?: string) => undefined);
const tellerInitiateConnectionMock = jest.fn(async (_setupToken?: string) => undefined);

jest.mock('@/hooks/useProviderCatalog', () => {
  const React = require('react') as typeof import('react');

  return {
    useProviderCatalog: () => {
      const [userProvider, setUserProvider] = React.useState<FinancialProvider | null>(null);

      return {
        loading: false,
        error: null,
        availableProviders: ['teller', 'simplefin', 'plaid'],
        userProvider,
        tellerApplicationId: 'app-123',
        tellerEnvironment: 'development',
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
    initiateConnection:
      provider === 'plaid' ? plaidInitiateConnectionMock : tellerInitiateConnectionMock,
    retryConnection: jest.fn(),
    reset: jest.fn(),
    setError: jest.fn(),
    connectionMount: <div data-testid={`${provider}-connection-mount`} />,
  }),
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
    footerContent,
  }: {
    onSelectProvider: (provider: 'plaid' | 'teller' | 'simplefin') => void;
    footerContent?: React.ReactNode;
  }) => (
    <div>
      <button type="button" onClick={() => onSelectProvider('teller')}>
        Pick Teller
      </button>
      <button type="button" onClick={() => onSelectProvider('simplefin')}>
        Pick SimpleFIN
      </button>
      <button type="button" onClick={() => onSelectProvider('plaid')}>
        Pick Plaid
      </button>
      {footerContent}
    </div>
  ),
}));

jest.mock('@/services/authService', () => ({
  AuthService: {
    completeOnboarding: jest.fn().mockResolvedValue({
      message: 'ok',
      onboarding_completed: true,
    }),
  },
}));

describe('OnboardingProviderPicker', () => {
  beforeEach(() => {
    chooseProviderMock.mockClear();
    plaidInitiateConnectionMock.mockClear();
    tellerInitiateConnectionMock.mockClear();
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

  it('skips onboarding without selecting a provider', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();

    render(
      <ThemeTestProvider>
        <OnboardingProviderPicker onComplete={onComplete} />
      </ThemeTestProvider>
    );

    await user.click(screen.getByRole('button', { name: /skip for now/i }));

    expect(chooseProviderMock).not.toHaveBeenCalled();
    expect(AuthService.completeOnboarding).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
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

  it('starts teller connect without opening the modal', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTestProvider>
        <OnboardingProviderPicker onComplete={jest.fn()} />
      </ThemeTestProvider>
    );

    await user.click(screen.getByRole('button', { name: /pick teller/i }));

    expect(tellerInitiateConnectionMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('provider-connect-modal')).not.toBeInTheDocument();
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
});
