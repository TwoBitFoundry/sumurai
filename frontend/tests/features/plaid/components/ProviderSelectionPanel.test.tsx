import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { ProviderSelectionPanel } from '@/features/plaid/components/ProviderSelectionPanel';
import { ThemeTestProvider } from '../../../utils/ThemeTestProvider';

function renderPanel(props: Partial<ComponentProps<typeof ProviderSelectionPanel>> = {}) {
  return render(
    <ThemeTestProvider>
      <ProviderSelectionPanel
        loading={false}
        error={null}
        availableProviders={['plaid', 'teller']}
        tellerApplicationId={null}
        connectingProvider={null}
        onSelectProvider={jest.fn()}
        {...props}
      />
    </ThemeTestProvider>
  );
}

describe('ProviderSelectionPanel', () => {
  it('renders the fixed provider order, wireframe copy, and privacy links', () => {
    renderPanel({
      availableProviders: ['plaid', 'teller', 'simplefin'],
      tellerApplicationId: 'app-123',
    });

    expect(screen.getByText('Choose how you connect accounts')).toBeVisible();
    expect(
      screen.getByText('Pick the provider that fits your household, budget, and privacy needs.')
    ).toBeVisible();
    expect(screen.getByText('Self-Managed')).toBeVisible();
    expect(screen.getAllByText('DIY')).toHaveLength(1);
    expect(screen.getByText('US Only')).toBeVisible();
    expect(screen.getByText('US, CA')).toBeVisible();
    expect(screen.getByText('US, CA, UK, EU')).toBeVisible();
    expect(screen.getByText('Any (USD)')).toBeVisible();
    expect(screen.getByText('$1.50/mo')).toBeVisible();
    expect(screen.getByText('Pay/use')).toBeVisible();
    expect(screen.getByText('~7,000 Institutions')).toBeVisible();
    expect(screen.getByText('~16,000 Institutions')).toBeVisible();
    expect(screen.getByText('~12,000 Institutions')).toBeVisible();
    expect(screen.getByText('Strong')).toBeVisible();
    expect(screen.getByText('Broad')).toBeVisible();

    const privacyLinks = screen.getAllByRole('link', { name: /privacy policy/i });

    expect(privacyLinks).toHaveLength(3);
    expect(privacyLinks[0]).toHaveAttribute(
      'href',
      'https://beta-bridge.simplefin.org/info/privacy'
    );
    expect(privacyLinks[1]).toHaveAttribute('href', 'https://teller.io/legal');
    expect(privacyLinks[2]).toHaveAttribute('href', 'https://plaid.com/legal/#consumers');

    const buttons = screen.getAllByRole('button', { name: /link account/i });

    expect(buttons).toHaveLength(4);
    expect(buttons[0]).toHaveAccessibleName('Link Account');
    expect(buttons[1]).toHaveAccessibleName('Link Account');
    expect(buttons[2]).toHaveAccessibleName('Link Account');
    expect(buttons[3]).toHaveAccessibleName('Link Account');
  });

  it('keeps Teller disabled with missing credentials while SimpleFIN stays enabled', async () => {
    const user = userEvent.setup();
    const onSelectProvider = jest.fn();

    renderPanel({
      availableProviders: ['plaid', 'simplefin'],
      onSelectProvider,
    });

    const buttons = screen.getAllByRole('button', { name: 'Link Account' });
    const simpleFinButton = buttons[1];
    const tellerButton = buttons[2];

    expect(tellerButton).toBeDisabled();
    expect(simpleFinButton).toBeEnabled();
    expect(screen.getAllByText('Missing credentials')).toHaveLength(1);

    await user.click(tellerButton);

    expect(onSelectProvider).not.toHaveBeenCalled();
  });

  it('keeps Plaid disabled when its credentials are missing', async () => {
    const user = userEvent.setup();
    const onSelectProvider = jest.fn();

    renderPanel({
      availableProviders: ['simplefin'],
      onSelectProvider,
    });

    const buttons = screen.getAllByRole('button', { name: 'Link Account' });
    const simpleFinButton = buttons[1];
    const tellerButton = buttons[2];
    const plaidButton = buttons[3];

    expect(tellerButton).toBeDisabled();
    expect(plaidButton).toBeDisabled();
    expect(simpleFinButton).toBeEnabled();
    expect(screen.getAllByText('Missing credentials')).toHaveLength(2);

    await user.click(plaidButton);

    expect(onSelectProvider).not.toHaveBeenCalled();
  });

  it('keeps SimpleFIN enabled even when no provider credentials are configured', () => {
    renderPanel({
      availableProviders: [],
    });

    const buttons = screen.getAllByRole('button', { name: 'Link Account' });

    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeEnabled();
    expect(buttons[2]).toBeDisabled();
    expect(buttons[3]).toBeDisabled();
    expect(screen.getAllByText('Missing credentials')).toHaveLength(2);
  });

  it('keeps connect buttons neutral after selection is initiated', async () => {
    const user = userEvent.setup();
    const onSelectProvider = jest.fn();

    renderPanel({
      availableProviders: ['plaid', 'teller', 'simplefin'],
      tellerApplicationId: 'app-123',
      onSelectProvider,
    });

    await user.click(screen.getAllByRole('button', { name: 'Link Account' })[2]);

    expect(onSelectProvider).toHaveBeenCalledWith('teller');
    expect(screen.queryByRole('button', { name: 'Selected' })).not.toBeInTheDocument();
  });

  it('renders DIY as fourth card with Sync row showing Manual uploads', () => {
    renderPanel({
      availableProviders: ['plaid', 'teller', 'simplefin', 'diy'],
      tellerApplicationId: 'app-123',
    });

    expect(screen.getAllByText('DIY')).toHaveLength(1);
    expect(screen.getByText('Self-Managed')).toBeVisible();
    expect(screen.getAllByText('Any (USD)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sync')).toHaveLength(4);
    expect(screen.getByText('Manual uploads')).toBeVisible();
    expect(screen.getAllByText('On-demand')).toHaveLength(3);
    expect(document.querySelectorAll('svg.lucide-x')).toHaveLength(1);
  });

  it('keeps popup providers disabled until their secure connection is prepared', () => {
    renderPanel({
      availableProviders: ['plaid', 'teller', 'simplefin'],
      tellerApplicationId: 'app-123',
      providerReadyState: {
        plaid: false,
        teller: false,
        simplefin: true,
      },
    });

    const buttons = screen.getAllByRole('button', { name: /^(Loading…|Link Account)$/ });

    expect(buttons[0]).toHaveAccessibleName('Link Account');
    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toHaveAccessibleName('Link Account');
    expect(buttons[1]).toBeEnabled();
    expect(buttons[2]).toHaveAccessibleName('Loading…');
    expect(buttons[2]).toBeDisabled();
    expect(screen.getAllByText('Preparing secure connection')).toHaveLength(1);
  });

  it('renders a top-right close control when onClose is provided', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();

    renderPanel({ onClose });

    const closeButton = screen.getByRole('button', { name: 'Close provider picker' });
    expect(closeButton).toBeVisible();

    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders only the providers listed in visibleProviders', () => {
    renderPanel({
      availableProviders: ['plaid', 'teller', 'simplefin', 'diy'],
      tellerApplicationId: 'app-123',
      visibleProviders: ['diy', 'teller'],
    });

    expect(screen.getByText('Self-Managed')).toBeVisible();
    expect(screen.getByText('Teller')).toBeVisible();
    expect(screen.queryByText('SimpleFIN')).not.toBeInTheDocument();
    expect(screen.queryByText('Plaid')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /link account/i })).toHaveLength(2);
  });
});
