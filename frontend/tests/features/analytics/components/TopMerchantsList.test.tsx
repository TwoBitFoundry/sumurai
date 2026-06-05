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

  it('uses a single column on smaller layouts', () => {
    const { container } = render(<TopMerchantsList merchants={sampleTopMerchants} />);

    expect(container.firstElementChild).toHaveClass('flex', 'flex-col');
    expect(container.querySelector('.grid')).toHaveClass(
      'grid-cols-[repeat(auto-fit,minmax(min(100%,33rem),1fr))]'
    );
    expect(screen.getByText('Corner Market')).toBeInTheDocument();
    expect(screen.getByText('14 items')).toBeInTheDocument();
  });
});
