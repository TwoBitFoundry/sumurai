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
          'data-accessibility-layer':
            typeof props.accessibilityLayer === 'boolean'
              ? String(props.accessibilityLayer)
              : undefined,
          'data-class-name': typeof props.className === 'string' ? props.className : undefined,
          onClick: props.onClick as React.MouseEventHandler<HTMLDivElement> | undefined,
          onMouseEnter: props.onMouseEnter as React.MouseEventHandler<HTMLDivElement> | undefined,
          onMouseLeave: props.onMouseLeave as React.MouseEventHandler<HTMLDivElement> | undefined,
          'data-animation-duration': props.animationDuration,
          'data-is-animation-active': props.isAnimationActive,
          'data-animation-begin': props.animationBegin,
          'data-fill': typeof props.fill === 'string' ? props.fill : undefined,
          'data-style':
            typeof props.style === 'object' && props.style != null
              ? JSON.stringify(props.style)
              : undefined,
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
