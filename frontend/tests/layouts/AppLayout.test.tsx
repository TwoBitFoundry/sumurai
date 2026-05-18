import { render } from '@testing-library/react';
import { AppLayout } from '@/layouts/AppLayout';

jest.mock('@/ui/primitives/AppTitleBar', () => ({
  AppTitleBar: () => <header data-testid="app-title-bar" />,
  TABS: [],
  appTitleBarRecipes: {
    pillContainer: [],
    pillTab: [],
  },
}));

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
    const { container } = render(
      <AppLayout currentTab="dashboard" onTabChange={jest.fn()} onLogout={jest.fn()} isOnline>
        <div>Content</div>
      </AppLayout>
    );

    const root = container.firstElementChild;
    const main = container.querySelector('main');

    expect(root).toHaveClass('min-h-screen');
    expect(root).toHaveClass('flex');
    expect(root).toHaveClass('flex-col');
    expect(main).toHaveClass('flex-1');
    expect(main).toHaveClass('md:pl-[calc(3rem_+_env(safe-area-inset-left))]');
    expect(main).toHaveClass('md:pt-6');
    expect(main).toHaveClass('lg:pl-[calc(4rem_+_env(safe-area-inset-left))]');
    expect(main).not.toHaveClass('sm:pl-[calc(3rem_+_env(safe-area-inset-left))]', 'sm:pt-6');
  });
});
