import { render, screen } from '@testing-library/react';
import { useTheme } from '@/context/ThemeContext';
import { TopMerchantsList } from '@/features/analytics/components/TopMerchantsList';
import { sampleTopMerchants } from '@/storybook/fixtures/analytics';
import { getThemeColors } from '@/ui/tokens';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

describe('TopMerchantsList', () => {
  beforeEach(() => {
    jest.mocked(useTheme).mockReturnValue({
      preference: 'light',
      mode: 'light',
      setPreference: jest.fn(),
      setMode: jest.fn(),
      toggle: jest.fn(),
      colors: getThemeColors('light'),
    } as any);
  });

  it('uses one column on mobile and two columns on tablet and desktop', () => {
    const { container } = render(<TopMerchantsList merchants={sampleTopMerchants} />);

    expect(container.firstElementChild).toHaveClass('flex', 'flex-col');
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('md:grid-cols-2');
    expect(screen.getByText('Corner Market')).toBeInTheDocument();
    expect(screen.getByText('14×')).toBeInTheDocument();
  });
});
