import { render, screen } from '@testing-library/react';
import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { SpendingByCategoryChart } from '@/features/analytics/components/SpendingByCategoryChart';
import { getThemeColors } from '@/ui/tokens';

jest.mock('@/context/ThemeContext', () => ({
  useTheme: jest.fn(),
}));

jest.mock('recharts', () => {
  const mockComponent =
    (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
      React.createElement(
        'div',
        {
          'data-testid': name,
          'data-animation-duration': props.animationDuration,
          'data-is-animation-active': props.isAnimationActive,
          'data-animation-begin': props.animationBegin,
        },
        children
      );

  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'ResponsiveContainer' }, children),
    PieChart: mockComponent('PieChart'),
    Pie: mockComponent('Pie'),
    Cell: mockComponent('Cell'),
    Tooltip: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
      React.createElement(
        'div',
        {
          'data-testid': 'Tooltip',
          'data-border-radius': (props.contentStyle as { borderRadius?: string } | undefined)
            ?.borderRadius,
        },
        children
      ),
  };
});

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
