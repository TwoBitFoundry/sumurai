import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingProviderPicker } from '@/components/onboarding/OnboardingProviderPicker';
import { AuthService } from '@/services/authService';
import type { FinancialProvider } from '@/types/api';
import { ThemeTestProvider } from '../../utils/ThemeTestProvider';

const chooseProviderMock = jest.fn(async (provider: FinancialProvider) => {
  setSelectedProvider(provider);
});

let setSelectedProvider: ((provider: FinancialProvider | null) => void) | null = null;

jest.mock('@/hooks/useProviderCatalog', () => {
  const React = require('react') as typeof import('react');

  return {
    useProviderCatalog: () => {
      const [userProvider, setUserProvider] = React.useState<FinancialProvider | null>(null);

      setSelectedProvider = setUserProvider;

      return {
        loading: false,
        error: null,
        availableProviders: ['teller', 'simplefin', 'plaid'],
        selectedProvider: userProvider,
        defaultProvider: null,
        userProvider,
        tellerApplicationId: 'app-123',
        tellerEnvironment: 'development',
        isProviderAvailable: jest.fn(),
        canConnectWith: jest.fn(),
        getConnectBlockedReason: jest.fn(),
        resolveConnectProvider: jest.fn(),
        refresh: jest.fn(),
        chooseProvider: chooseProviderMock,
      };
    },
  };
});

jest.mock('@/features/plaid/components/ProviderSelectionPanel', () => ({
  ProviderSelectionPanel: ({
    onSelectProvider,
  }: {
    onSelectProvider: (provider: FinancialProvider) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSelectProvider('simplefin')}>
        Pick SimpleFIN
      </button>
      <button type="button" onClick={() => onSelectProvider('plaid')}>
        Pick Plaid
      </button>
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
    jest.mocked(AuthService.completeOnboarding).mockClear();
    setSelectedProvider = null;
  });

  it('keeps continue disabled until a provider is selected', async () => {
    const user = userEvent.setup();

    render(
      <ThemeTestProvider>
        <OnboardingProviderPicker onComplete={jest.fn()} />
      </ThemeTestProvider>
    );

    const continueButton = screen.getByRole('button', { name: /continue/i });

    expect(continueButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /pick simplefin/i }));

    expect(chooseProviderMock).toHaveBeenCalledWith('simplefin');

    await waitFor(() => {
      expect(continueButton).toBeEnabled();
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

  it('continues after selection by completing onboarding', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();

    render(
      <ThemeTestProvider>
        <OnboardingProviderPicker onComplete={onComplete} />
      </ThemeTestProvider>
    );

    await user.click(screen.getByRole('button', { name: /pick plaid/i }));

    expect(chooseProviderMock).toHaveBeenCalledWith('plaid');
    expect(AuthService.completeOnboarding).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(AuthService.completeOnboarding).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });
  });
});
