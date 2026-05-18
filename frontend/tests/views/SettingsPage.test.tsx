import { fireEvent, render, screen } from '@testing-library/react';
import { useTheme } from '@/context/ThemeContext';
import SettingsPage from '@/views/SettingsPage';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

describe('SettingsPage', () => {
  it('renders the appearance section and updates theme preference from settings', () => {
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

    const themeBadge = screen.getByText('THEME');
    const appearanceLabel = screen.getByText('Appearance');
    const appearanceRow = container.querySelector('div.flex.flex-col.gap-3');

    expect(appearanceLabel).toBeInTheDocument();
    expect(themeBadge.compareDocumentPosition(appearanceLabel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(appearanceRow).toHaveClass('md:flex-row');
    expect(appearanceRow).toHaveClass('md:items-center');
    expect(appearanceRow).toHaveClass('md:justify-between');
    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(setPreference).toHaveBeenCalledWith('light');
  });
});
