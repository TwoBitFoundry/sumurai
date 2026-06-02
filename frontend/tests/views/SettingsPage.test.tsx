import { fireEvent, render, screen } from '@testing-library/react';
import { useTheme } from '@/context/ThemeContext';
import SettingsPage from '@/views/SettingsPage';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('@/features/settings/PasskeySecuritySection', () => ({
  PasskeySecuritySection: () => <div data-testid="passkey-security-section" />,
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

    const { container } = render(<SettingsPage />);

    const pageContainer = container.firstElementChild as HTMLElement;
    const accountSettingsBadge = screen.getByText('Settings');
    const appearanceLabel = screen.getByText('Adjust your appearance');
    const accountSettingsCard = accountSettingsBadge.closest('[class*="space-y-5"]');
    const themeSelector = screen.getByRole('radiogroup', { name: 'Theme' });

    expect(pageContainer).toHaveClass('w-full');
    expect(pageContainer).toHaveClass('max-w-3xl');
    expect(screen.queryByRole('button', { name: 'Back to Dashboard' })).not.toBeInTheDocument();
    expect(appearanceLabel).toBeInTheDocument();
    expect(accountSettingsBadge.compareDocumentPosition(appearanceLabel)).toBe(
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
});
