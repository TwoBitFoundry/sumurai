import { cleanup, render, screen } from '@testing-library/react';
import { ThemeTestProvider } from '@tests/utils/ThemeTestProvider';
import { SpendingByCategoryChart } from '@/features/analytics/components/SpendingByCategoryChart';

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: ({ children }: any) => <div>{children}</div>,
  Cell: () => <div />,
  Tooltip: () => <div />,
}));

describe('SpendingByCategoryChart', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders spending total with a negative sign', () => {
    const data = [{ name: 'Food', value: 5040.72 }];
    render(
      <ThemeTestProvider>
        <SpendingByCategoryChart
          data={data}
          total={5040.72}
          hoveredCategory={null}
          setHoveredCategory={jest.fn()}
        />
      </ThemeTestProvider>
    );

    expect(screen.getByText('-$5,040.72')).toBeInTheDocument();
  });

  it('renders zero without negative sign when total is 0', () => {
    const data = [{ name: 'Food', value: 0 }];
    render(
      <ThemeTestProvider>
        <SpendingByCategoryChart
          data={data}
          total={0}
          hoveredCategory={null}
          setHoveredCategory={jest.fn()}
        />
      </ThemeTestProvider>
    );

    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });
});
