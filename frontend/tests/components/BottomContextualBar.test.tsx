import { render, screen } from '@testing-library/react';
import { BottomContextualBar } from '@/components/BottomContextualBar';

jest.mock('@/components/HeaderAccountFilter', () => ({
  HeaderAccountFilter: () => <div data-testid="header-account-filter" />,
}));

describe('BottomContextualBar', () => {
  it('renders the account filter before contextual content', () => {
    render(
      <BottomContextualBar>
        <div data-testid="contextual-menu">Menu</div>
      </BottomContextualBar>
    );

    const bar = screen.getByTestId('bottom-contextual-bar');
    const children = Array.from(bar.children);

    expect(children[0]).toContainElement(screen.getByTestId('header-account-filter'));
    expect(children[1]).toContainElement(screen.getByTestId('contextual-menu'));
    expect(children[1]).toHaveClass('min-w-0', 'flex-1');
    expect(bar.className).toContain('gap-2');
  });
});
