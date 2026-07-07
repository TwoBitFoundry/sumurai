import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { useTheme } from '@/context/ThemeContext';
import { useBillingStatus } from '@/hooks/useBillingStatus';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';
import SettingsPage from '@/views/SettingsPage';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('@/features/settings/PasskeySecuritySection', () => ({
  PasskeySecuritySection: () => <div data-testid="passkey-security-section" />,
}));

jest.mock('@/hooks/useBillingStatus', () => ({
  useBillingStatus: jest.fn(),
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.mocked(useBillingStatus).mockReturnValue({
      status: null,
      loading: false,
      error: null,
      billingEnabled: false,
      shouldShowBilling: false,
      refresh: jest.fn(),
    });
  });

  it('renders appearance inside account settings and updates theme preference', () => {
    const setPreference = jest.fn();
    jest.mocked(useTheme).mockReturnValue({
      preference: 'system',
      mode: 'dark',
      setPreference,
      setMode: jest.fn(),
      toggle: jest.fn(),
      colors: {} as any,
    } as any);

    const queryClient = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ControlTooltipProvider>
          <SettingsPage />
        </ControlTooltipProvider>
      </QueryClientProvider>
    );

    const pageContainer = container.firstElementChild as HTMLElement;
    const pageTitle = screen.getByRole('heading', { level: 1, name: 'Inspect the armory' });
    const appearanceLabel = screen.getByText('Brandish your colors');
    const accountSettingsCard = pageTitle.closest('[class*="space-y-5"]');
    const themeSelector = screen.getByRole('radiogroup', { name: 'Theme' });

    expect(pageContainer).toHaveClass('w-full');
    expect(pageContainer).toHaveClass('max-w-3xl');
    expect(screen.queryByRole('button', { name: 'Back to Dashboard' })).not.toBeInTheDocument();
    expect(appearanceLabel).toBeInTheDocument();
    expect(accountSettingsCard).toContainElement(pageTitle);
    expect(pageTitle.compareDocumentPosition(appearanceLabel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(accountSettingsCard).toContainElement(themeSelector);
    expect(themeSelector).toHaveClass('grid');
    expect(themeSelector).toHaveClass('w-full');
    expect(screen.queryByRole('heading', { name: 'Change Password' })).not.toBeInTheDocument();
    expect(screen.getByTestId('passkey-security-section')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(setPreference).toHaveBeenCalledWith('light');
  });

  it('does not render billing controls when backend status disables billing', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ControlTooltipProvider>
          <SettingsPage />
        </ControlTooltipProvider>
      </QueryClientProvider>
    );

    expect(screen.queryByRole('heading', { name: 'Billing' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upgrade' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Trial code')).not.toBeInTheDocument();
  });

  it('renders upgrade and trial redemption controls when backend enables billing', () => {
    jest.mocked(useBillingStatus).mockReturnValue({
      status: {
        billing_enabled: true,
        access_status: 'demo',
        can_use_own_data: false,
        is_demo_mode_active: true,
        trial_ends_at: null,
        current_period_ends_at: null,
        payment_method_required: false,
        billing_portal_available: false,
        enabled_financial_providers: ['plaid', 'diy'],
      },
      loading: false,
      error: null,
      billingEnabled: true,
      shouldShowBilling: true,
      refresh: jest.fn(),
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ControlTooltipProvider>
          <SettingsPage />
        </ControlTooltipProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeInTheDocument();
    expect(screen.getByLabelText('Trial code')).toBeInTheDocument();
    expect(screen.getByLabelText('Country')).toHaveValue('US');
    expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument();
  });

  it('renders trial payment method action with the trial end date', () => {
    jest.mocked(useBillingStatus).mockReturnValue({
      status: {
        billing_enabled: true,
        access_status: 'trialing',
        can_use_own_data: true,
        is_demo_mode_active: false,
        trial_ends_at: '2026-07-31T00:00:00Z',
        current_period_ends_at: null,
        payment_method_required: true,
        billing_portal_available: true,
        enabled_financial_providers: ['plaid', 'diy'],
      },
      loading: false,
      error: null,
      billingEnabled: true,
      shouldShowBilling: true,
      refresh: jest.fn(),
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ControlTooltipProvider>
          <SettingsPage />
        </ControlTooltipProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Trial ends/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add payment method' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeInTheDocument();
  });
});
