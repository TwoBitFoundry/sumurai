import '../../../mocks/rechartsSpendingByCategory';
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { getThemeColors } from '@/ui/tokens';

const mockUseTheme = mock(() => ({
  preference: 'light' as const,
  mode: 'light' as const,
  setPreference: mock(() => {}),
  setMode: mock(() => {}),
  toggle: mock(() => {}),
  colors: getThemeColors('light'),
}));

mock.module('@/context/ThemeContext', () => ({
  useTheme: mockUseTheme,
}));

import { SpendingByCategoryChart } from '@/features/analytics/components/SpendingByCategoryChart';

describe('SpendingByCategoryChart', () => {
  let rectSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    rectSpy = spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 240,
      height: 240,
      top: 0,
      left: 0,
      bottom: 240,
      right: 240,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    mockUseTheme.mockReturnValue({
      preference: 'light',
      mode: 'light',
      setPreference: mock(() => {}),
      setMode: mock(() => {}),
      toggle: mock(() => {}),
      colors: getThemeColors('light'),
    });
  });

  afterEach(() => {
    rectSpy.mockRestore();
  });

  it('renders the pie chart with animation enabled', () => {
    const setHoveredCategory = mock(() => {});
    const { container } = render(
      <SpendingByCategoryChart
        data={[{ name: 'Food', value: 10, color: '#123456' }]}
        total={10}
        hoveredCategory={null}
        setHoveredCategory={setHoveredCategory}
      />
    );

    expect(container.firstElementChild).toHaveClass('min-h-[220px]', 'md:min-h-0');
    expect(screen.getByTestId('PieChart').getAttribute('data-accessibility-layer')).toBe('false');
    expect(screen.getByTestId('Pie').getAttribute('data-animation-duration')).toBe('800');
    expect(screen.getByTestId('Pie').getAttribute('data-is-animation-active')).toBe('true');
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
