import { render, screen } from '@testing-library/react';
import { BottomContextualBar } from '@/components/BottomContextualBar';

jest.mock('@/components/HeaderAccountFilter', () => ({
  HeaderAccountFilter: () => <div data-testid="header-account-filter" />,
}));

describe('BottomContextualBar', () => {
  it('renders separate filter and contextual slots without overlapping layout', () => {
    render(
      <BottomContextualBar>
        <div data-testid="contextual-menu">Menu</div>
      </BottomContextualBar>
    );

    const bar = screen.getByTestId('bottom-contextual-bar');
    const children = Array.from(bar.children);

    expect(bar.className).toContain('gap-3');
    expect(children[0]).toHaveClass('shrink-0');
    expect(children[0]).toContainElement(screen.getByTestId('header-account-filter'));
    expect(children[1]).toHaveClass('min-w-0', 'flex-1');
    expect(children[1]).toContainElement(screen.getByTestId('contextual-menu'));
  });
});
