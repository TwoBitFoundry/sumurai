import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { ProviderSelectionPanel } from '@/features/plaid/components/ProviderSelectionPanel';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';
import { ThemeTestProvider } from '../../../utils/ThemeTestProvider';

function renderPanel(props: Partial<ComponentProps<typeof ProviderSelectionPanel>> = {}) {
  return render(
    <ThemeTestProvider>
      <ControlTooltipProvider>
        <ProviderSelectionPanel
          loading={false}
          error={null}
          availableProviders={['plaid', 'teller']}
          tellerApplicationId={null}
          connectingProvider={null}
          onSelectProvider={jest.fn()}
          {...props}
        />
      </ControlTooltipProvider>
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
      screen.queryByText('Pick the provider that fits your household, budget, and privacy needs.')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Self-Managed')).toBeVisible();
    expect(screen.getAllByText('DIY')).toHaveLength(1);
    expect(screen.getByText('US Only')).toBeVisible();
    expect(screen.getByText('US, CA')).toBeVisible();
    expect(screen.getByText('US, CA, UK, EU')).toBeVisible();
    expect(screen.getByText('Any (USD)')).toBeVisible();
    expect(screen.getByText('$1.50/mo')).toBeVisible();
    expect(screen.getByText('Pay/use')).toBeVisible();
    expect(screen.getByText('~7K Banks')).toBeVisible();
    expect(screen.getByText('~16K Banks')).toBeVisible();
    expect(screen.getByText('~12K Banks')).toBeVisible();
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

  it('keeps Teller unavailable with missing credentials while SimpleFIN stays enabled', async () => {
    const user = userEvent.setup();
    const onSelectProvider = jest.fn();

    renderPanel({
      availableProviders: ['plaid', 'simplefin'],
      onSelectProvider,
    });

    const buttons = screen.getAllByRole('button', { name: 'Link Account' });
    const simpleFinButton = buttons[1];
    const tellerButton = screen.getByRole('button', { name: 'Unavailable' });

    expect(tellerButton).toBeDisabled();
    expect(simpleFinButton).toBeEnabled();
    expect(screen.queryByText('Missing credentials')).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Loading…' })).not.toBeInTheDocument();
    expect(screen.queryByText('Preparing secure connection')).not.toBeInTheDocument();

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
    const unavailableButtons = screen.getAllByRole('button', { name: 'Unavailable' });

    expect(unavailableButtons).toHaveLength(2);
    expect(unavailableButtons.every((button) => button.hasAttribute('disabled'))).toBe(true);
    expect(simpleFinButton).toBeEnabled();
    expect(screen.queryByText('Missing credentials')).not.toBeInTheDocument();

    await user.click(unavailableButtons[1]!);

    expect(onSelectProvider).not.toHaveBeenCalled();
  });

  it('keeps SimpleFIN enabled even when no provider credentials are configured', () => {
    renderPanel({
      availableProviders: [],
    });

    const buttons = screen.getAllByRole('button', { name: 'Link Account' });

    expect(buttons[0]).toBeEnabled();
    expect(buttons[1]).toBeEnabled();
    expect(screen.getAllByRole('button', { name: 'Unavailable' })).toHaveLength(2);
    expect(screen.queryByText('Missing credentials')).not.toBeInTheDocument();
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

  it('renders DIY as fourth card with Sync row showing Import', () => {
    renderPanel({
      availableProviders: ['plaid', 'teller', 'simplefin', 'diy'],
      tellerApplicationId: 'app-123',
    });

    expect(screen.getAllByText('DIY')).toHaveLength(1);
    expect(screen.getByText('Self-Managed')).toBeVisible();
    expect(screen.getAllByText('Any (USD)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sync')).toHaveLength(4);
    expect(screen.getByText('Import')).toBeVisible();
    expect(screen.getAllByText('Yes')).toHaveLength(3);
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

  it('renders hero actions in the top-right hero slot', () => {
    renderPanel({
      heroAction: <button type="button">Skip for now</button>,
    });

    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeVisible();
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

  it('shows hover labels on connect buttons', async () => {
    const user = userEvent.setup();

    renderPanel({
      availableProviders: ['plaid', 'teller', 'simplefin'],
      tellerApplicationId: 'app-123',
    });

    const simpleFinButton = screen.getAllByRole('button', { name: 'Link Account' })[1]!;

    expect(simpleFinButton).not.toHaveAttribute('title');

    await user.hover(simpleFinButton);

    await waitFor(() => {
      expect(screen.getAllByText('Link Account').length).toBeGreaterThan(1);
    });
  });

  it('shows concise hover labels on privacy info buttons', async () => {
    const user = userEvent.setup();

    renderPanel({
      availableProviders: ['plaid', 'teller', 'simplefin'],
      tellerApplicationId: 'app-123',
    });

    const privacyInfoButton = screen.getAllByRole('button', {
      name: 'Privacy details for Privacy',
    })[0]!;

    expect(privacyInfoButton).not.toHaveAttribute('title');

    await user.hover(privacyInfoButton);

    await waitFor(() => {
      expect(screen.getAllByText('Privacy details').length).toBeGreaterThan(1);
    });
  });
});
