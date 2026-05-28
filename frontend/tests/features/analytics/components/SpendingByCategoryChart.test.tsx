import '../../../mocks/rechartsSpendingByCategory';
import { fireEvent, render, screen } from '@testing-library/react';
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
    const setHoveredCategory = jest.fn();
    const { container } = render(
      <SpendingByCategoryChart
        data={[{ name: 'Food', value: 10, color: '#123456' }]}
        total={10}
        hoveredCategory={null}
        setHoveredCategory={setHoveredCategory}
        animated={false}
      />
    );

    expect(screen.getByTestId('PieChart').getAttribute('data-accessibility-layer')).toBe('false');
    expect(screen.getByTestId('Pie')).toHaveAttribute('data-animation-duration', '0');
    expect(screen.getByTestId('Pie')).toHaveAttribute('data-is-animation-active', 'false');
    expect(screen.getByTestId('Cell')).toHaveAttribute('data-fill', '#123456');
    expect(screen.getByTestId('Cell').getAttribute('data-style')).toContain('"outline":"none"');
    expect(screen.getByTestId('Tooltip')).toHaveAttribute(
      'data-border-radius',
      'var(--radius-standard)'
    );

    fireEvent.click(screen.getByTestId('Cell'));
    expect(setHoveredCategory).toHaveBeenCalledWith('Food');
  });
});
