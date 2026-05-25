import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingProviderConnectModal } from '@/components/onboarding/OnboardingProviderConnectModal';
import { ThemeTestProvider } from '../../utils/ThemeTestProvider';

const initiateConnectionMock = jest.fn(async (_setupToken?: string) => undefined);

let mockConnectionInProgress = false;
let mockIsConnected = false;

jest.mock('@/hooks/useFinancialConnection', () => ({
  useFinancialConnection: () => ({
    isConnected: mockIsConnected,
    connectionInProgress: mockConnectionInProgress,
    isSyncing: false,
    institutionName: null,
    error: null,
    initiateConnection: initiateConnectionMock,
    retryConnection: jest.fn(),
    reset: jest.fn(),
    setError: jest.fn(),
    connectionMount: <div data-testid="connection-mount" />,
  }),
}));

describe('OnboardingProviderConnectModal', () => {
  beforeEach(() => {
    initiateConnectionMock.mockClear();
    mockConnectionInProgress = false;
    mockIsConnected = false;
  });

  it('auto-initiates teller connect without showing a modal dialog', async () => {
    const onClose = jest.fn();

    render(
      <ThemeTestProvider>
        <OnboardingProviderConnectModal
          provider="teller"
          isOpen
          onClose={onClose}
          onConnected={jest.fn()}
        />
      </ThemeTestProvider>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('connection-mount')).toBeInTheDocument();

    await waitFor(() => {
      expect(initiateConnectionMock).toHaveBeenCalledTimes(1);
    });
  });

  it('calls onClose when teller sdk exits without connecting', async () => {
    const onClose = jest.fn();

    const { rerender } = render(
      <ThemeTestProvider>
        <OnboardingProviderConnectModal
          provider="teller"
          isOpen
          onClose={onClose}
          onConnected={jest.fn()}
        />
      </ThemeTestProvider>
    );

    act(() => {
      mockConnectionInProgress = true;
    });

    rerender(
      <ThemeTestProvider>
        <OnboardingProviderConnectModal
          provider="teller"
          isOpen
          onClose={onClose}
          onConnected={jest.fn()}
        />
      </ThemeTestProvider>
    );

    act(() => {
      mockConnectionInProgress = false;
    });

    rerender(
      <ThemeTestProvider>
        <OnboardingProviderConnectModal
          provider="teller"
          isOpen
          onClose={onClose}
          onConnected={jest.fn()}
        />
      </ThemeTestProvider>
    );

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the simplefin setup token field in a modal and submits it', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    render(
      <ThemeTestProvider>
        <OnboardingProviderConnectModal
          provider="simplefin"
          isOpen
          onClose={onClose}
          onConnected={jest.fn()}
        />
      </ThemeTestProvider>
    );

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByLabelText('SimpleFIN setup token')).toBeVisible();

    await user.type(screen.getByLabelText('SimpleFIN setup token'), 'setup-token-123');
    await user.click(screen.getByRole('button', { name: /^connect$/i }));

    await waitFor(() => {
      expect(initiateConnectionMock).toHaveBeenCalledWith('setup-token-123');
    });

    await user.click(screen.getByRole('button', { name: /close simplefin/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
