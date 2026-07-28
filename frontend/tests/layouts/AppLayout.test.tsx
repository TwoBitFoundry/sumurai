import { render } from '@testing-library/react';
import type React from 'react';
import { AppLayout } from '@/layouts/AppLayout';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';
import { appLayout } from '@/ui/recipes';

function renderAppLayout(ui: React.ReactElement) {
  return render(<ControlTooltipProvider>{ui}</ControlTooltipProvider>);
}

jest.mock('@/ui/primitives/AppTitleBar', () => {
  const actual = jest.requireActual(
    '@/ui/primitives/AppTitleBar'
  ) as typeof import('@/ui/primitives/AppTitleBar');
  return {
    AppTitleBar: () => <header data-testid="app-title-bar" />,
    TABS: actual.TABS,
    appTitleBarRecipes: actual.appTitleBarRecipes,
  };
});

jest.mock('@/ui/primitives/AppFooter', () => ({
  AppFooter: () => <footer data-testid="app-footer" />,
}));

jest.mock('@/components/HeaderAccountFilter', () => ({
  HeaderAccountFilter: () => <div data-testid="header-account-filter" />,
}));

jest.mock('@/hooks/useScrollDetection', () => ({
  useScrollDetection: () => false,
}));

describe('AppLayout', () => {
  it('keeps the authenticated shell full height so the footer stays below the initial viewport', () => {
    const { container } = renderAppLayout(
      <AppLayout currentTab="dashboard" onTabChange={jest.fn()} onLogout={jest.fn()} isOnline>
        <div>Content</div>
      </AppLayout>
    );

    const root = container.firstElementChild;
    const main = container.querySelector('main');

    expect(root).toHaveClass('min-h-dvh');
    expect(root).toHaveClass('flex');
    expect(root).toHaveClass('flex-col');
    expect(main).toHaveClass('flex-1');
    expect(main).toHaveClass(...appLayout.mainSafeArea);
    expect(main).toHaveClass('md:pt-6');
    expect(main).not.toHaveClass('overflow-hidden');
    expect(main).not.toHaveClass('md:pl-[calc(3rem_+_env(safe-area-inset-left))]');

    const contentShell = main?.firstElementChild;
    expect(contentShell).toHaveClass('max-w-[var(--spacing-content-max)]');
    expect(contentShell).toHaveClass('md:px-6');
    expect(contentShell).toHaveClass('lg:px-8');
    expect(contentShell).not.toHaveClass('sm:px-6');
  });

  it('shows the footer on the dashboard tab only', () => {
    const { rerender, queryByTestId } = renderAppLayout(
      <AppLayout currentTab="dashboard" onTabChange={jest.fn()} onLogout={jest.fn()} isOnline>
        <div>Content</div>
      </AppLayout>
    );

    expect(queryByTestId('app-footer')).toBeInTheDocument();
    expect(queryByTestId('footer-intersection-sentinel')).toBeInTheDocument();

    rerender(
      <ControlTooltipProvider>
        <AppLayout currentTab="transactions" onTabChange={jest.fn()} onLogout={jest.fn()} isOnline>
          <div>Content</div>
        </AppLayout>
      </ControlTooltipProvider>
    );

    expect(queryByTestId('app-footer')).not.toBeInTheDocument();
    expect(queryByTestId('footer-intersection-sentinel')).not.toBeInTheDocument();
  });

  it('uses stacked bottom padding when contextual content is present', () => {
    const { container } = renderAppLayout(
      <AppLayout
        currentTab="budgets"
        onTabChange={jest.fn()}
        onLogout={jest.fn()}
        isOnline
        bottomBarContent={<div>Controls</div>}
      >
        <div>Content</div>
      </AppLayout>
    );

    expect(container.querySelector('main')).toHaveClass(appLayout.mainBottomPaddingStackedMobile);
    expect(container.querySelector('main')).toHaveClass(appLayout.mainBottomPaddingStackedTablet);
  });

  it('always renders the floating primary tab bar', () => {
    const { container } = renderAppLayout(
      <AppLayout currentTab="dashboard" onTabChange={jest.fn()} onLogout={jest.fn()} isOnline>
        <div>Content</div>
      </AppLayout>
    );

    expect(container.querySelector('nav[aria-label="Primary"]')).toBeTruthy();
    expect(container.querySelector('.fixed.bottom-0')).toBeTruthy();
    expect(container.querySelector('.fixed.bottom-0')).toHaveClass(
      appLayout.floatingChromeSafeArea
    );
  });

  it('centers bottom contextual content', () => {
    const { container } = renderAppLayout(
      <AppLayout
        currentTab="dashboard"
        onTabChange={jest.fn()}
        onLogout={jest.fn()}
        isOnline
        bottomBarContent={<div data-testid="contextual-menu">Menu</div>}
      >
        <div>Content</div>
      </AppLayout>
    );

    expect(container.querySelector('.min-h-\\[3\\.25rem\\].flex.justify-center')).toBeTruthy();
    expect(container.querySelector('[data-testid="contextual-menu"]')).toBeInTheDocument();
  });

  it('lets clicks pass through the floating chrome shell outside control bounds', () => {
    const { container } = renderAppLayout(
      <AppLayout
        currentTab="dashboard"
        onTabChange={jest.fn()}
        onLogout={jest.fn()}
        isOnline
        bottomBarContent={<div data-testid="contextual-menu">Menu</div>}
      >
        <div>Content</div>
      </AppLayout>
    );

    const shell = container.querySelector('.fixed.bottom-0');
    const contextualRow = container.querySelector('.min-h-\\[3\\.25rem\\]');
    const contextualControls = container.querySelector(
      '[data-testid="contextual-menu"]'
    )?.parentElement;
    const mobileNav = container.querySelector('nav[aria-label="Primary"]');

    expect(shell).toHaveClass('pointer-events-none');
    expect(contextualRow).toHaveClass('pointer-events-none');
    expect(contextualControls).toHaveClass('pointer-events-auto');
    expect(mobileNav).toHaveClass('pointer-events-auto');
  });

  it('omits the mobile tab spacer when the tab bar is hidden from md upward', () => {
    const { container } = renderAppLayout(
      <AppLayout
        currentTab="dashboard"
        onTabChange={jest.fn()}
        onLogout={jest.fn()}
        isOnline
        bottomBarContent={<div data-testid="contextual-menu">Menu</div>}
      >
        <div>Content</div>
      </AppLayout>
    );

    expect(container.querySelector('[aria-hidden].hidden.md\\:block')).not.toBeInTheDocument();
  });

  it('omits stacked bottom chrome row on accounts when there is no contextual content', () => {
    const { container, queryByTestId } = renderAppLayout(
      <AppLayout currentTab="accounts" onTabChange={jest.fn()} onLogout={jest.fn()} isOnline>
        <div>Content</div>
      </AppLayout>
    );

    expect(queryByTestId('header-account-filter')).not.toBeInTheDocument();
    expect(container.querySelector('.min-h-\\[3\\.25rem\\]')).not.toBeInTheDocument();
  });
});
