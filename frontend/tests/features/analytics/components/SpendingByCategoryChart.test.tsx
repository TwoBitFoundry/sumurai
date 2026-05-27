import '../../../mocks/rechartsSpendingByCategory';
import { render, screen } from '@testing-library/react';
import { useTheme } from '@/context/ThemeContext';
import { SpendingByCategoryChart } from '@/features/analytics/components/SpendingByCategoryChart';
import { getThemeColors } from '@/ui/tokens';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

describe('SpendingByCategoryChart', () => {
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

  it('disables pie animation when animated is false', () => {
    const { container } = render(
      <SpendingByCategoryChart
        data={[{ name: 'Food', value: 10 }]}
        total={10}
        hoveredCategory={null}
        setHoveredCategory={jest.fn()}
        animated={false}
      />
    );

    expect(container.querySelector('.aspect-square')).toHaveClass('max-w-[315px]');
    expect(container.querySelector('.aspect-square')).toHaveClass('md:max-w-[260px]');
    expect(container.querySelector('.aspect-square')).toHaveClass('self-center');
    expect(screen.getByTestId('Pie')).toHaveAttribute('data-animation-duration', '0');
    expect(screen.getByTestId('Pie')).toHaveAttribute('data-is-animation-active', 'false');
    expect(screen.getByTestId('Tooltip')).toHaveAttribute(
      'data-border-radius',
      'var(--radius-standard)'
    );
  });
});
