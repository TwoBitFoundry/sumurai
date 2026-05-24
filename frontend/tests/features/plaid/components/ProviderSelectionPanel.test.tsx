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
        selectingProvider={null}
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

    expect(screen.getByText('Self-Hosted')).toBeVisible();
    expect(screen.getByText('Choose how you connect accounts')).toBeVisible();
    expect(
      screen.getByText(
        'Select the provider that best fits your location, budget, and privacy priorities.'
      )
    ).toBeVisible();
    expect(screen.getByText('US Only')).toBeVisible();
    expect(screen.getByText('US, CA')).toBeVisible();
    expect(screen.getByText('US, CA, UK, EU')).toBeVisible();
    expect(screen.getByText('Free')).toBeVisible();
    expect(screen.getByText('$1.50/mo')).toBeVisible();
    expect(screen.getByText('Pay/use')).toBeVisible();
    expect(screen.getByText('~7,000 Institutions')).toBeVisible();
    expect(screen.getByText('~16,000 Institutions')).toBeVisible();
    expect(screen.getByText('~12,000 Institutions')).toBeVisible();
    expect(screen.getByText('Moderate')).toBeVisible();
    expect(screen.getByText('Strongest')).toBeVisible();
    expect(screen.getByText('Broad')).toBeVisible();

    const privacyLinks = screen.getAllByRole('link', { name: /privacy policy/i });

    expect(privacyLinks).toHaveLength(3);
    expect(privacyLinks[0]).toHaveAttribute('href', 'https://teller.io/legal');
    expect(privacyLinks[1]).toHaveAttribute(
      'href',
      'https://beta-bridge.simplefin.org/info/privacy'
    );
    expect(privacyLinks[2]).toHaveAttribute('href', 'https://plaid.com/legal/#consumers');

    const buttons = screen.getAllByRole('button', { name: /select/i });

    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveAccessibleName('Select');
    expect(buttons[1]).toHaveAccessibleName('Select');
    expect(buttons[2]).toHaveAccessibleName('Select');
  });

  it('keeps Teller disabled with missing credentials while SimpleFIN stays enabled', async () => {
    const user = userEvent.setup();
    const onSelectProvider = jest.fn();

    renderPanel({
      availableProviders: ['plaid', 'simplefin'],
      onSelectProvider,
    });

    const buttons = screen.getAllByRole('button', { name: 'Select' });
    const tellerButton = buttons[0];
    const simpleFinButton = buttons[1];

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

    const buttons = screen.getAllByRole('button', { name: 'Select' });
    const tellerButton = buttons[0];
    const plaidButton = buttons[2];
    const simpleFinButton = buttons[1];

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

    const buttons = screen.getAllByRole('button', { name: 'Select' });

    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeEnabled();
    expect(buttons[2]).toBeDisabled();
    expect(screen.getAllByText('Missing credentials')).toHaveLength(2);
  });
});
