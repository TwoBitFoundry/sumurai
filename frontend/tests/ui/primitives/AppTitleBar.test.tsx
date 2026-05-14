import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AppTitleBar } from '@/ui/primitives/AppTitleBar';
import { buttonRecipes } from '@/ui/primitives/Button';
import { status as uiStatusRecipes } from '@/ui/recipes';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, width, height, ...props }: { alt: string; width: number; height: number }) =>
    React.createElement('img', {
      alt,
      'data-width': width,
      'data-height': height,
      ...props,
    }),
}));

describe('AppTitleBar', () => {
  const baseProps = {
    state: 'authenticated' as const,
    scrolled: false,
    currentTab: 'dashboard' as const,
    onTabChange: jest.fn(),
  };

  it('shows the online indicator when connected', () => {
    render(<AppTitleBar {...baseProps} isOnline />);

    expect(screen.getByTitle('Online')).toHaveTextContent('Online');
    expect(screen.getByTitle('Online')).toHaveClass(
      ...uiStatusRecipes.success.surface,
      ...uiStatusRecipes.success.border,
      ...uiStatusRecipes.success.text
    );
  });

  it('shows the offline indicator when disconnected', () => {
    render(<AppTitleBar {...baseProps} isOnline={false} />);

    expect(screen.getByTitle('Offline')).toHaveTextContent('Offline');
    expect(screen.getByTitle('Offline')).toHaveClass(
      ...uiStatusRecipes.warning.surface,
      ...uiStatusRecipes.warning.border,
      ...uiStatusRecipes.warning.text
    );
  });

  it('keeps the title bar chrome fixed when scrolled changes', () => {
    const { rerender } = render(<AppTitleBar {...baseProps} isOnline scrolled={false} />);

    const desktopNav = screen.getByRole('navigation', { name: 'Primary' });
    const initialState = {
      headerClassName: screen.getByRole('banner').className,
      dashboardButtonClassName: within(desktopNav).getByRole('button', { name: 'Dashboard' })
        .className,
      logoWidth: screen.getByAltText('Sumurai Logo').getAttribute('data-width'),
      logoHeight: screen.getByAltText('Sumurai Logo').getAttribute('data-height'),
    };

    rerender(<AppTitleBar {...baseProps} isOnline scrolled={true} />);

    const desktopNavAfter = screen.getByRole('navigation', { name: 'Primary' });
    expect({
      headerClassName: screen.getByRole('banner').className,
      dashboardButtonClassName: within(desktopNavAfter).getByRole('button', { name: 'Dashboard' })
        .className,
      logoWidth: screen.getByAltText('Sumurai Logo').getAttribute('data-width'),
      logoHeight: screen.getByAltText('Sumurai Logo').getAttribute('data-height'),
    }).toEqual(initialState);
  });

  it('does not render the theme toggle in the title bar', () => {
    render(<AppTitleBar {...baseProps} isOnline />);

    expect(screen.queryByRole('button', { name: 'Toggle theme' })).not.toBeInTheDocument();
  });

  it('renders authenticated tabs inside a unified pill nav with icons and active styling', () => {
    render(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const desktopNav = screen.getByRole('navigation', { name: 'Primary' });
    expect(desktopNav.className).toContain('rounded-full');
    expect(desktopNav.className).toContain('p-1');

    const dashboardButton = within(desktopNav).getByRole('button', { name: 'Dashboard' });
    const transactionsButton = within(desktopNav).getByRole('button', { name: 'Transactions' });

    expect(dashboardButton.querySelector('svg')).not.toBeNull();
    expect(transactionsButton.querySelector('svg')).not.toBeNull();
    expect(dashboardButton.className).toContain('relative');
    expect(dashboardButton.className).toContain('h-full');
    expect(transactionsButton.className).toContain('relative');
    expect(within(desktopNav).getByText('Dashboard')).toBeInTheDocument();
    expect(within(desktopNav).queryByText('Transactions')).not.toBeInTheDocument();
    expect(within(desktopNav).queryByText('Budgets')).not.toBeInTheDocument();
    expect(within(desktopNav).queryByText('Accounts')).not.toBeInTheDocument();

    const activeLayer = dashboardButton.querySelector('[data-slot="active-pill"]');
    expect(activeLayer).not.toBeNull();
    expect(dashboardButton).toHaveClass(...buttonRecipes.tabActive);
    expect(transactionsButton.querySelector('[data-slot="active-pill"]')).toBeNull();

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Logout' })).toHaveLength(2);
  });

  it('keeps desktop tab switching wired to the same tab change callback', async () => {
    const onTabChange = jest.fn();
    const user = userEvent.setup();

    render(<AppTitleBar {...baseProps} isOnline onTabChange={onTabChange} />);

    const desktopNav = screen.getByRole('navigation', { name: 'Primary' });
    await user.click(within(desktopNav).getByRole('button', { name: 'Transactions' }));

    expect(onTabChange).toHaveBeenCalledWith('transactions');
  });

  describe('mobile layout', () => {
    const mobileProps = {
      state: 'authenticated' as const,
      scrolled: false,
      currentTab: 'dashboard' as const,
      onTabChange: jest.fn(),
      isOnline: true,
      onLogout: jest.fn(),
    };

    it('header has h-auto class for mobile-first height', () => {
      render(<AppTitleBar {...mobileProps} />);
      expect(screen.getByRole('banner').className).toContain('h-auto');
    });

    it('desktop nav has hidden md:flex classes for responsive visibility', () => {
      render(<AppTitleBar {...mobileProps} />);
      const desktopNav = screen.getByRole('navigation', { name: 'Primary' });
      expect(desktopNav.className).toContain('hidden');
      expect(desktopNav.className).toContain('md:flex');
    });

    it('renders a mobile pill nav with "Mobile primary" label', () => {
      render(<AppTitleBar {...mobileProps} />);
      const mobileNav = screen.getByRole('navigation', { name: 'Mobile primary' });
      expect(mobileNav).toBeInTheDocument();
      expect(mobileNav.parentElement?.className).toContain('md:hidden');
    });

    it('mobile nav active tab label is expanded, inactive labels are collapsed', () => {
      render(<AppTitleBar {...mobileProps} currentTab="dashboard" />);
      const mobileNav = screen.getByRole('navigation', { name: 'Mobile primary' });

      const activeButton = within(mobileNav).getByRole('button', { name: 'Dashboard' });
      const activeLabel = activeButton.querySelector('span.relative');
      expect(activeLabel?.className).toContain('max-w-[5rem]');
      expect(activeLabel?.className).toContain('opacity-100');

      const inactiveButton = within(mobileNav).getByRole('button', { name: 'Transactions' });
      const inactiveLabel = inactiveButton.querySelector('span.relative');
      expect(inactiveLabel?.className).toContain('max-w-0');
      expect(inactiveLabel?.className).toContain('opacity-0');
    });

    it('desktop online pill is hidden on mobile, visible on desktop', () => {
      render(<AppTitleBar {...mobileProps} />);
      const onlinePill = screen.getByTitle('Online');
      expect(onlinePill.className).toContain('hidden');
      expect(onlinePill.className).toContain('md:inline-flex');
    });

    it('renders both a desktop logout and a mobile icon-only logout button', () => {
      render(<AppTitleBar {...mobileProps} />);
      const logoutButtons = screen.getAllByRole('button', { name: 'Logout' });
      expect(logoutButtons).toHaveLength(2);
      const desktopLogout = logoutButtons.find((btn) => btn.className.includes('md:inline-flex'));
      const mobileLogout = logoutButtons.find((btn) => btn.className.includes('md:hidden'));
      expect(desktopLogout).toBeDefined();
      expect(mobileLogout).toBeDefined();
    });
  });
});
