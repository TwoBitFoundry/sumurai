import { render, screen } from '@testing-library/react';
import { BalancesBankTooltip } from '@/features/analytics/components/BalancesBankTooltip';

const tooltipProps = {
  coordinate: { x: 0, y: 0 },
  accessibilityLayer: false,
  activeIndex: '0',
};

describe('BalancesBankTooltip', () => {
  it('renders institution balances when active', () => {
    render(
      <BalancesBankTooltip
        active
        label="Chase"
        {...tooltipProps}
        payload={[
          {
            graphicalItemId: 'item-1',
            payload: {
              bank: 'Chase',
              cash: 123642.1,
              investments: 0,
              credit: -4713.4,
              loan: 0,
            },
          },
        ]}
      />
    );

    expect(screen.getByRole('tooltip')).toHaveTextContent('Chase');
    expect(screen.getByRole('tooltip')).toHaveTextContent('$123,642.10');
    expect(screen.getByRole('tooltip')).toHaveTextContent('-$4,713.40');
  });

  it('renders nothing when inactive', () => {
    const { container } = render(
      <BalancesBankTooltip
        active={false}
        label="Chase"
        {...tooltipProps}
        payload={[
          {
            graphicalItemId: 'item-1',
            payload: {
              bank: 'Chase',
              cash: 1,
              investments: 0,
              credit: 0,
              loan: 0,
            },
          },
        ]}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
