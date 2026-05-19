import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AppTitleBar } from '@/ui/primitives/AppTitleBar';

jest.mock('framer-motion', () => {
  const R = require('react');
  return {
    motion: {
      div: ({ layoutId, transition, children, 'data-testid': testId, ...props }: any) =>
        R.createElement('div', { 'data-testid': testId, ...props }, children),
    },
  };
});

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

    const indicator = screen.getByTitle('Online');
    expect(indicator).toBeInTheDocument();
    expect(indicator.querySelector('svg')).not.toBeNull();
  });

  it('shows the offline indicator when disconnected', () => {
    render(<AppTitleBar {...baseProps} isOnline={false} />);

    const indicator = screen.getByTitle('Offline');
    expect(indicator).toBeInTheDocument();
    expect(indicator.querySelector('svg')).not.toBeNull();
  });

  it('keeps the title bar chrome fixed when scrolled changes', () => {
    const { rerender } = render(<AppTitleBar {...baseProps} isOnline scrolled={false} />);

    const initialState = {
      headerClassName: screen.getByRole('banner').className,
      logoWidth: screen.getByAltText('Sumurai Logo').getAttribute('data-width'),
      logoHeight: screen.getByAltText('Sumurai Logo').getAttribute('data-height'),
    };

    rerender(<AppTitleBar {...baseProps} isOnline scrolled={true} />);

    expect({
      headerClassName: screen.getByRole('banner').className,
      logoWidth: screen.getByAltText('Sumurai Logo').getAttribute('data-width'),
      logoHeight: screen.getByAltText('Sumurai Logo').getAttribute('data-height'),
    }).toEqual(initialState);
  });

  it('does not render the theme toggle in the title bar', () => {
    render(<AppTitleBar {...baseProps} isOnline />);

    expect(screen.queryByRole('button', { name: 'Toggle theme' })).not.toBeInTheDocument();
  });

  it('does not render primary tab navigation in the title bar', () => {
    render(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Transactions' })).not.toBeInTheDocument();
  });

  it('renders settings and logout actions for authenticated users', async () => {
    const onTabChange = jest.fn();
    const user = userEvent.setup();

    render(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} onTabChange={onTabChange} />);

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Logout' })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onTabChange).toHaveBeenCalledWith('settings');
  });

  it('navigates to dashboard when the logo is clicked', async () => {
    const onTabChange = jest.fn();
    const user = userEvent.setup();

    render(
      <AppTitleBar
        {...baseProps}
        isOnline
        currentTab="settings"
        onTabChange={onTabChange}
        onLogout={jest.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Go to dashboard' }));
    expect(onTabChange).toHaveBeenCalledWith('dashboard');
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

    it('header has safe-area-inset-top padding for notch/camera cutout', () => {
      render(<AppTitleBar {...mobileProps} />);
      expect(screen.getByRole('banner').className).toContain('pt-[env(safe-area-inset-top)]');
    });

    it('online connectivity icon is always present (no responsive hiding)', () => {
      render(<AppTitleBar {...mobileProps} />);
      const indicator = screen.getByTitle('Online');
      expect(indicator).toBeInTheDocument();
      expect(indicator.className).not.toContain('hidden');
    });

    it('renders both a desktop logout and a mobile icon-only logout button', () => {
      render(<AppTitleBar {...mobileProps} />);
      const logoutButtons = screen.getAllByRole('button', { name: 'Logout' });
      expect(logoutButtons).toHaveLength(2);
      const desktopLogout = logoutButtons.find((btn) =>
        btn.parentElement?.className.includes('hidden')
      );
      const mobileLogout = logoutButtons.find((btn) =>
        btn.parentElement?.className.includes('md:hidden')
      );
      expect(desktopLogout).toBeDefined();
      expect(mobileLogout).toBeDefined();
    });
  });
});
