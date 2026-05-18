import { fireEvent, render, screen } from '@testing-library/react';
import { useTheme } from '@/context/ThemeContext';
import SettingsPage from '@/views/SettingsPage';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

describe('SettingsPage', () => {
  it('renders appearance inside account settings and updates theme preference', () => {
    const setPreference = jest.fn();
    const onBack = jest.fn();
    jest.mocked(useTheme).mockReturnValue({
      preference: 'system',
      mode: 'dark',
      setPreference,
      setMode: jest.fn(),
      toggle: jest.fn(),
      colors: {} as any,
    } as any);

    const { container } = render(<SettingsPage onBack={onBack} />);

    const pageContainer = container.firstElementChild as HTMLElement;
    const accountSettingsBadge = screen.getByText('ACCOUNT SETTINGS');
    const appearanceLabel = screen.getByText('Appearance');
    const changePasswordHeading = screen.getByRole('heading', { name: 'Change Password' });
    const accountSettingsCard = accountSettingsBadge.closest('[class*="space-y-5"]');
    const backButton = screen.getByRole('button', { name: 'Back to Dashboard' });
    const themeSelector = screen.getByRole('radiogroup', { name: 'Theme' });

    expect(pageContainer).toHaveClass('w-full');
    expect(pageContainer).toHaveClass('md:px-8');
    expect(pageContainer).not.toHaveClass('max-w-2xl');
    expect(backButton.compareDocumentPosition(accountSettingsBadge)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(backButton).toHaveClass('lg:hidden');
    expect(backButton).toHaveClass('border');
    expect(backButton.className).toContain('border-[var(--color-border-subtle)]');
    expect(appearanceLabel).toBeInTheDocument();
    expect(accountSettingsBadge.compareDocumentPosition(appearanceLabel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(appearanceLabel.compareDocumentPosition(changePasswordHeading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(accountSettingsCard).toContainElement(themeSelector);
    expect(themeSelector).toHaveClass('grid');
    expect(themeSelector).toHaveClass('w-full');
    expect(container).toHaveTextContent('Update your password to keep your account secure.');
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(setPreference).toHaveBeenCalledWith('light');
  });
});
