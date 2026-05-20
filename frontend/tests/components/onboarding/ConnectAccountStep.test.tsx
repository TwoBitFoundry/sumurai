import { render, screen } from '@testing-library/react';
import { ConnectAccountStep } from '@/components/onboarding/ConnectAccountStep';
import { CONNECT_ACCOUNT_PROVIDER_CONTENT } from '@/utils/providerCards';

describe('ConnectAccountStep', () => {
  it('disables the primary action and explains offline availability', () => {
    const { container } = render(
      <ConnectAccountStep
        content={CONNECT_ACCOUNT_PROVIDER_CONTENT.teller}
        providerLoading={false}
        providerError={null}
        onRetryProvider={jest.fn()}
        connectBlockedReason={null}
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
    expect(screen.getByAltText('Teller logo')).toHaveAttribute('src', '/teller.webp');
    expect(screen.getByRole('button', { name: /teller/i })).toBeDisabled();
  });

  it('renders the Teller logo on the primary action button', () => {
    render(
      <ConnectAccountStep
        content={CONNECT_ACCOUNT_PROVIDER_CONTENT.teller}
        providerLoading={false}
        providerError={null}
        onRetryProvider={jest.fn()}
        connectBlockedReason={null}
        isOnline={true}
        isConnected={false}
        connectionInProgress={false}
        institutionName={null}
        error={null}
        onConnect={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(screen.getByAltText('Teller logo')).toHaveAttribute('src', '/teller.webp');
    expect(screen.getByRole('button', { name: /teller/i })).toBeEnabled();
  });

  it('renders the Plaid connect action without extra guidance', () => {
    render(
      <ConnectAccountStep
        content={CONNECT_ACCOUNT_PROVIDER_CONTENT.plaid}
        providerLoading={false}
        providerError={null}
        onRetryProvider={jest.fn()}
        connectBlockedReason={null}
        isOnline={true}
        isConnected={false}
        connectionInProgress={false}
        institutionName={null}
        error={null}
        onConnect={jest.fn()}
        onRetry={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /connect with plaid/i })).toBeInTheDocument();
    expect(
      screen.queryByText(
        'If this provider does not open, disable your ad blocker or privacy extension for this site, then try again.'
      )
    ).toBeNull();
    expect(screen.getByAltText('Plaid logo')).toHaveAttribute('src', '/plaid.webp');
  });
});
