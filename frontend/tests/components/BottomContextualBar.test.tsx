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
    const controls = screen.getByTestId('bottom-contextual-bar-controls');
    const children = Array.from(controls.children);

    expect(controls.className).toContain('gap-3');
    expect(controls.className).toContain('w-fit');
    expect(controls.className).toContain('mx-auto');
    expect(children[0]).toHaveClass('shrink-0');
    expect(children[0]).toContainElement(screen.getByTestId('header-account-filter'));
    expect(children[1]).toHaveClass('min-w-0', 'shrink-0');
    expect(children[1]).toContainElement(screen.getByTestId('contextual-menu'));
    expect(bar).toContainElement(controls);
  });

  it('renders top content edge to edge across the full bar width', () => {
    render(
      <BottomContextualBar topContent={<div data-testid="top-content">Range</div>}>
        <div data-testid="contextual-menu">Menu</div>
      </BottomContextualBar>
    );

    const topRow = screen.getByTestId('bottom-contextual-bar-top');
    expect(topRow.className).toContain('w-full');
    expect(topRow.className).toContain('overflow-visible');
    expect(topRow.className).not.toContain('justify-center');
    expect(topRow).toContainElement(screen.getByTestId('top-content'));
  });
});
