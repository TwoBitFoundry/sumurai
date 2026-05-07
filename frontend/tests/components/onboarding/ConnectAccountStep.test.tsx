import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectAccountStep } from '@/components/onboarding/ConnectAccountStep';
import { getConnectAccountProviderContent } from '@/utils/providerCards';

const plaidContent = getConnectAccountProviderContent('plaid');

describe('ConnectAccountStep', () => {
  afterEach(() => {
    cleanup();
  });

  it('calls onConnect when the primary action is activated', async () => {
    const onConnect = jest.fn();
    const user = userEvent.setup();

    render(
      <ConnectAccountStep
        content={plaidContent}
        providerLoading={false}
        providerError={null}
        tellerApplicationId={null}
        isConnected={false}
        connectionInProgress={false}
        institutionName={null}
        error={null}
        onConnect={onConnect}
        onRetry={jest.fn()}
      />
    );

    const primary = screen.getByRole('button', {
      name: new RegExp(plaidContent.cta.defaultLabel, 'i'),
    });
    await user.click(primary);
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('disables the primary action while provider configuration is loading', () => {
    render(
      <ConnectAccountStep
        content={plaidContent}
        providerLoading
        providerError={null}
        tellerApplicationId={null}
        isConnected={false}
        connectionInProgress={false}
        institutionName={null}
        error={null}
        onConnect={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    const primary = screen.getByRole('button', {
      name: new RegExp(plaidContent.cta.defaultLabel, 'i'),
    });
    expect(primary).toBeDisabled();
    expect(screen.getByText(/loading provider configuration/i)).toBeInTheDocument();
  });

  it('surfaces connection failure copy and routes retry through onRetry when error is set', async () => {
    const onRetry = jest.fn();
    const user = userEvent.setup();

    render(
      <ConnectAccountStep
        content={plaidContent}
        providerLoading={false}
        providerError={null}
        tellerApplicationId={null}
        isConnected={false}
        connectionInProgress={false}
        institutionName={null}
        error="Link interrupted"
        onConnect={jest.fn()}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
    expect(screen.getByText(/link interrupted/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^try again$/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
