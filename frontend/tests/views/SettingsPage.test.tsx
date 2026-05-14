import { fireEvent, render, screen } from '@testing-library/react';
import { useTheme } from '@/context/ThemeContext';
import SettingsPage from '@/views/SettingsPage';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

describe('SettingsPage', () => {
  it('renders the appearance section and toggles theme from settings', () => {
    const toggle = jest.fn();
    jest.mocked(useTheme).mockReturnValue({
      mode: 'dark',
      toggle,
    } as any);

    render(<SettingsPage />);

    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
