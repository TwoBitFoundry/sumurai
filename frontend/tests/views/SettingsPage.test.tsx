import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { useTheme } from '@/context/ThemeContext';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';
import SettingsPage from '@/views/SettingsPage';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('@/features/settings/PasskeySecuritySection', () => ({
  PasskeySecuritySection: () => <div data-testid="passkey-security-section" />,
}));

jest.mock('@/features/settings/PlanSection', () => ({
  PlanSection: () => <section data-testid="plan-section">Plan section</section>,
}));

describe('SettingsPage', () => {
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
    const preferencesCard = appearanceLabel.closest('[class*="space-y-5"]');
    const themeSelector = screen.getByRole('radiogroup', { name: 'Theme' });

    expect(pageContainer).toHaveClass('w-full');
    expect(pageContainer).toHaveClass('max-w-3xl');
    expect(screen.queryByRole('button', { name: 'Back to Dashboard' })).not.toBeInTheDocument();
    expect(appearanceLabel).toBeInTheDocument();
    expect(preferencesCard).not.toContainElement(pageTitle);
    expect(pageTitle.compareDocumentPosition(appearanceLabel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(preferencesCard).toContainElement(themeSelector);
    expect(themeSelector).toHaveClass('grid');
    expect(themeSelector).toHaveClass('w-full');
    expect(screen.queryByRole('heading', { name: 'Change Password' })).not.toBeInTheDocument();
    expect(screen.getByTestId('passkey-security-section')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(setPreference).toHaveBeenCalledWith('light');
  });

  it('renders the plan section between preferences and account deletion', () => {
    jest.mocked(useTheme).mockReturnValue({
      preference: 'system',
      mode: 'dark',
      setPreference: jest.fn(),
      setMode: jest.fn(),
      toggle: jest.fn(),
      colors: {} as any,
    } as any);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ControlTooltipProvider>
          <SettingsPage />
        </ControlTooltipProvider>
      </QueryClientProvider>
    );

    const planSection = screen.getByTestId('plan-section');
    const passkeySection = screen.getByTestId('passkey-security-section');
    const dangerHeading = screen.getByRole('heading', { name: 'Retire from service' });

    expect(planSection.compareDocumentPosition(passkeySection)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(passkeySection.compareDocumentPosition(dangerHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});
