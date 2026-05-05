import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';

function ThemeProbe() {
  const { mode, toggle, setMode, colors } = useTheme();

  return (
    <div>
      <div data-testid="theme-mode">{mode}</div>
      <div data-testid="theme-primary">{colors.chart.primary[0]}</div>
      <button type="button" onClick={toggle}>
        Toggle
      </button>
      <button type="button" onClick={() => setMode('light')}>
        Light
      </button>
      <button type="button" onClick={() => setMode('dark')}>
        Dark
      </button>
    </div>
  );
}

describe('ThemeContext', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('defaults to dark mode and applies the dark class', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as any;

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark');
    });
    expect(screen.getByTestId('theme-primary')).toHaveTextContent('#38bdf8');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('uses stored light mode and persists toggles', async () => {
    (window.localStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      key === 'theme' ? 'light' : null
    );
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as any;

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-mode')).toHaveTextContent('light');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    await waitFor(() => {
      expect(screen.getByTestId('theme-mode')).toHaveTextContent('dark');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Light' }));

    await waitFor(() => {
      expect(screen.getByTestId('theme-mode')).toHaveTextContent('light');
    });
  });
});
