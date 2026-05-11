import { render, screen } from '@testing-library/react';
import { ConnectAccountStep } from '@/components/onboarding/ConnectAccountStep';
import { CONNECT_ACCOUNT_PROVIDER_CONTENT } from '@/utils/providerCards';

describe('ConnectAccountStep', () => {
  it('disables the primary action and explains offline availability', () => {
    render(
      <ConnectAccountStep
        content={CONNECT_ACCOUNT_PROVIDER_CONTENT.plaid}
        providerLoading={false}
        providerError={null}
        onRetryProvider={jest.fn()}
        tellerApplicationId={null}
        isOnline={false}
        isConnected={false}
        connectionInProgress={false}
        institutionName={null}
        error={null}
        onConnect={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(
      screen.getByText(
        'Unavailable while offline. Connect and sync are disabled until you are back online.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect with plaid/i })).toBeDisabled();
  });
});
