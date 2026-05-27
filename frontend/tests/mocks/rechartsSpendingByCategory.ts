import { mock } from 'bun:test';
import React from 'react';

mock.module('recharts', () => {
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
