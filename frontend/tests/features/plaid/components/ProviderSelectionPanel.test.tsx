import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProviderSelectionPanel from '@/features/plaid/components/ProviderSelectionPanel';

describe('ProviderSelectionPanel', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('renders loading and error states', () => {
    const { rerender } = render(
      <ProviderSelectionPanel
        loading
        error={null}
        selectedProvider={null}
        availableProviders={['plaid', 'teller']}
        selectingProvider={null}
        onSelectProvider={jest.fn()}
      />
    );

    expect(screen.getByTestId('provider-loading-panel')).toBeInTheDocument();

    rerender(
      <ProviderSelectionPanel
        loading={false}
        error="Provider lookup failed"
        selectedProvider={null}
        availableProviders={['plaid', 'teller']}
        selectingProvider={null}
        onSelectProvider={jest.fn()}
      />
    );

    expect(screen.getByTestId('provider-error-panel')).toBeInTheDocument();
    expect(screen.getByText('Provider lookup failed')).toBeInTheDocument();
  });

  it('renders selectable provider cards', async () => {
    const user = userEvent.setup();
    const onSelectProvider = jest.fn();

    render(
      <ProviderSelectionPanel
        loading={false}
        error={null}
        selectedProvider={null}
        availableProviders={['plaid', 'teller']}
        selectingProvider={null}
        onSelectProvider={onSelectProvider}
      />
    );

    expect(screen.getByText('Choose how you connect accounts')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /use plaid/i }));

    expect(onSelectProvider).toHaveBeenCalledWith('plaid');
  });
});
