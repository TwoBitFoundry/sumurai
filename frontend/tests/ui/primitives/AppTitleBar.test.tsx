import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AppTitleBar } from '@/ui/primitives/AppTitleBar';
import { chromeBar, control } from '@/ui/recipes';

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

  it('renders primary tab navigation in the title bar for tablet and desktop', () => {
    render(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const primaryNav = screen.getByRole('navigation', { name: 'Primary' });
    expect(primaryNav).toBeInTheDocument();
    expect(primaryNav.className).toContain('hidden');
    expect(primaryNav.className).toContain('md:flex');
  });

  it('anchors the action cluster to the right on tablet and desktop', () => {
    render(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const actions = screen.getByTitle('Online').closest('div');
    expect(actions?.className).toContain('md:col-start-3');
    expect(actions?.className).toContain('md:justify-self-end');
  });

  it('uses a single-row title bar grid on tablet and desktop', () => {
    render(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const grid = screen.getByRole('banner').querySelector('.grid');
    expect(grid?.className).toContain('grid-rows-1');
    expect(grid?.className).not.toContain('grid-rows-[auto_auto]');
    expect(grid?.className).not.toContain('gap-y-2');
  });

  it('sizes the logo to fill the title bar chrome on each breakpoint', () => {
    render(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const logoFrame = screen.getByAltText('Sumurai Logo').parentElement;
    expect(logoFrame?.className).toContain('h-12');
    expect(logoFrame?.className).toContain('w-12');
    expect(logoFrame?.className).not.toContain('lg:h-8');
  });

  it('uses context pill tabs for the desktop tab switcher', () => {
    render(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const primaryNav = screen.getByRole('navigation', { name: 'Primary' });
    const settingsTab = screen.getByRole('button', { name: 'Dashboard' });
    expect(settingsTab.className).toContain('rounded-lg');
    expect(settingsTab.className).not.toContain('flex-1');

    const pillContainer = primaryNav.firstElementChild;
    expect(pillContainer?.className).toContain('h-12');
    expect(pillContainer?.className).toContain('md:py-2');
    expect(pillContainer?.className).not.toContain('lg:h-8');
  });

  it('uses stronger body text for the primary tab labels', () => {
    render(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const primaryNav = screen.getByRole('navigation', { name: 'Primary' });
    expect(primaryNav.querySelector('.font-body-strong')).not.toBeNull();
  });

  it('uses md control sizing for the settings and logout actions', () => {
    render(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const settingsButton = screen.getByRole('button', { name: 'Settings' });
    expect(settingsButton.className).toContain(control.square.md);
    expect(settingsButton.querySelector('span')?.className).toContain(control.glyph.md);

    const logoutButton = screen.getByRole('button', { name: 'Logout' });
    expect(logoutButton.className).toContain(control.square.md);
    expect(logoutButton.querySelector('span')?.className).toContain(control.glyph.md);
  });

  it('renders settings and logout actions for authenticated users', async () => {
    const onTabChange = jest.fn();
    const user = userEvent.setup();

    render(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} onTabChange={onTabChange} />);

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Logout' })).toHaveLength(1);

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

    it('sizes the connectivity indicator to match action icon buttons', () => {
      render(<AppTitleBar {...mobileProps} />);

      const indicator = screen.getByTitle('Online');
      expect(indicator.className).toContain(control.square.md);
      expect(indicator.querySelector('span')?.className).toContain(control.glyph.md);

      const settingsButton = screen.getByRole('button', { name: 'Settings' });
      expect(settingsButton.className).toContain(control.square.md);
      expect(settingsButton.querySelector('span')?.className).toContain(control.glyph.md);
    });

    it('uses a single-row title bar grid on mobile', () => {
      render(<AppTitleBar {...mobileProps} />);

      const grid = screen.getByRole('banner').querySelector('.grid');
      expect(grid?.className).toContain('grid-rows-1');
      expect(grid?.className).toContain('content-center');
    });

    it('renders a single md-sized logout action', () => {
      render(<AppTitleBar {...mobileProps} />);

      const logoutButton = screen.getByRole('button', { name: 'Logout' });
      expect(logoutButton.className).toContain(control.square.md);
    });
  });
});
