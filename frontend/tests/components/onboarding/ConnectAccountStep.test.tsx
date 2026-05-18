import { render, screen } from '@testing-library/react';
import { ConnectAccountStep } from '@/components/onboarding/ConnectAccountStep';
import { CONNECT_ACCOUNT_PROVIDER_CONTENT } from '@/utils/providerCards';

describe('ConnectAccountStep', () => {
  it('disables the primary action and explains offline availability', () => {
    const { container } = render(
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
    expect(container.querySelector('div.grid.items-stretch.gap-8')).toHaveClass(
      'md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]'
    );
    expect(container.querySelectorAll('div.grid.gap-3')[0]).toHaveClass('md:grid-cols-3');
    expect(container.querySelectorAll('div.grid.gap-3')[1]).toHaveClass('md:grid-cols-2');
  });

  it('renders the Plaid connect action without extra guidance', () => {
    render(
      <ConnectAccountStep
        content={CONNECT_ACCOUNT_PROVIDER_CONTENT.plaid}
        providerLoading={false}
        providerError={null}
        onRetryProvider={jest.fn()}
        tellerApplicationId={null}
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
  });
});
