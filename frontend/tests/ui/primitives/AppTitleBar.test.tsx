import { render, screen } from '@testing-library/react';
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

    const initialState = {
      headerClassName: screen.getByRole('banner').className,
      dashboardButtonClassName: screen.getByRole('button', { name: 'Dashboard' }).className,
      logoWidth: screen.getByAltText('Sumurai Logo').getAttribute('data-width'),
      logoHeight: screen.getByAltText('Sumurai Logo').getAttribute('data-height'),
    };

    rerender(<AppTitleBar {...baseProps} isOnline scrolled={true} />);

    expect({
      headerClassName: screen.getByRole('banner').className,
      dashboardButtonClassName: screen.getByRole('button', { name: 'Dashboard' }).className,
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

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav.className).toContain('rounded-full');
    expect(nav.className).toContain('p-1');

    const dashboardButton = screen.getByRole('button', { name: 'Dashboard' });
    const transactionsButton = screen.getByRole('button', { name: 'Transactions' });

    expect(dashboardButton.querySelector('svg')).not.toBeNull();
    expect(transactionsButton.querySelector('svg')).not.toBeNull();
    expect(dashboardButton.className).toContain('relative');
    expect(transactionsButton.className).toContain('relative');

    const activeLayer = dashboardButton.querySelector('[data-slot="active-pill"]');
    expect(activeLayer).not.toBeNull();
    expect(activeLayer).toHaveClass(...buttonRecipes.tabActive);
    expect(transactionsButton.querySelector('[data-slot="active-pill"]')).toBeNull();

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  });

  it('keeps desktop tab switching wired to the same tab change callback', async () => {
    const onTabChange = jest.fn();
    const user = userEvent.setup();

    render(<AppTitleBar {...baseProps} isOnline onTabChange={onTabChange} />);

    await user.click(screen.getByRole('button', { name: 'Transactions' }));

    expect(onTabChange).toHaveBeenCalledWith('transactions');
  });
});
