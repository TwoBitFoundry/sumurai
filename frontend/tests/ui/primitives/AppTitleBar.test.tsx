import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AppTitleBar } from '@/ui/primitives/AppTitleBar';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';
import { chromeBar, control } from '@/ui/recipes';

function renderAppTitleBar(ui: React.ReactElement) {
  return render(<ControlTooltipProvider>{ui}</ControlTooltipProvider>);
}

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
    renderAppTitleBar(<AppTitleBar {...baseProps} isOnline />);

    const indicator = screen.getByRole('status', { name: 'Online' });
    expect(indicator).toBeInTheDocument();
    expect(indicator.querySelector('svg')).not.toBeNull();
  });

  it('shows the offline indicator when disconnected', () => {
    renderAppTitleBar(<AppTitleBar {...baseProps} isOnline={false} />);

    const indicator = screen.getByRole('status', { name: 'Offline' });
    expect(indicator).toBeInTheDocument();
    expect(indicator.querySelector('svg')).not.toBeNull();
  });

  it('keeps the title bar chrome fixed when scrolled changes', () => {
    const { rerender } = renderAppTitleBar(
      <AppTitleBar {...baseProps} isOnline scrolled={false} />
    );

    const initialState = {
      headerClassName: screen.getByRole('banner').className,
      logoWidth: screen.getByAltText('Sumurai Logo').getAttribute('data-width'),
      logoHeight: screen.getByAltText('Sumurai Logo').getAttribute('data-height'),
    };

    rerender(
      <ControlTooltipProvider>
        <AppTitleBar {...baseProps} isOnline scrolled={true} />
      </ControlTooltipProvider>
    );

    expect({
      headerClassName: screen.getByRole('banner').className,
      logoWidth: screen.getByAltText('Sumurai Logo').getAttribute('data-width'),
      logoHeight: screen.getByAltText('Sumurai Logo').getAttribute('data-height'),
    }).toEqual(initialState);
  });

  it('does not render the theme toggle in the title bar', () => {
    renderAppTitleBar(<AppTitleBar {...baseProps} isOnline />);

    expect(screen.queryByRole('button', { name: 'Toggle theme' })).not.toBeInTheDocument();
  });

  it('renders primary tab navigation in the title bar for tablet and desktop', () => {
    renderAppTitleBar(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const primaryNav = screen.getByRole('navigation', { name: 'Primary' });
    expect(primaryNav).toBeInTheDocument();
    expect(primaryNav.className).toContain('hidden');
    expect(primaryNav.className).toContain('md:flex');
  });

  it('anchors the action cluster to the right on tablet and desktop', () => {
    renderAppTitleBar(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const actions = screen.getByRole('status', { name: 'Online' }).closest('div');
    expect(actions?.className).toContain('md:col-start-3');
    expect(actions?.className).toContain('md:justify-self-end');
  });

  it('uses a single-row title bar grid on tablet and desktop', () => {
    renderAppTitleBar(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const grid = screen.getByRole('banner').querySelector('.grid');
    expect(grid?.className).toContain('grid-rows-1');
    expect(grid?.className).not.toContain('grid-rows-[auto_auto]');
    expect(grid?.className).not.toContain('gap-y-2');
  });

  it('sizes the logo to fill the title bar chrome on each breakpoint', () => {
    renderAppTitleBar(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const logoFrame = screen.getByAltText('Sumurai Logo').parentElement;
    expect(logoFrame?.className).toContain('h-12');
    expect(logoFrame?.className).toContain('w-12');
    expect(logoFrame?.className).not.toContain('lg:h-8');
  });

  it('uses context pill tabs for the desktop tab switcher', () => {
    renderAppTitleBar(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

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
    renderAppTitleBar(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const primaryNav = screen.getByRole('navigation', { name: 'Primary' });
    expect(primaryNav.querySelector('.font-body-strong')).not.toBeNull();
  });

  it('uses md control sizing for the settings and logout actions', () => {
    renderAppTitleBar(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const settingsButton = screen.getByRole('button', { name: 'Settings' });
    expect(settingsButton.className).toContain(control.square.md);
    expect(settingsButton.querySelector('span')?.className).toContain(control.glyph.md);

    const logoutButton = screen.getByRole('button', { name: 'Log off' });
    expect(logoutButton.className).toContain('aspect-square');
    expect(logoutButton.className).toContain('md:aspect-auto');
    expect(screen.getByText('Log off')).toHaveClass('hidden', 'md:inline');
  });

  it('uses tab active styling when the settings tab is selected', () => {
    renderAppTitleBar(
      <AppTitleBar {...baseProps} isOnline currentTab="settings" onLogout={jest.fn()} />
    );

    const settingsButton = screen.getByRole('button', { name: 'Settings' });
    expect(settingsButton.className).toContain('bg-[var(--color-brand-azure)]');
    expect(settingsButton.className).toContain('text-white');
    expect(settingsButton.className).not.toContain(
      'bg-[color:color-mix(in_srgb,var(--color-surface-card)'
    );
  });

  it('uses toolbar styling when the settings tab is not selected', () => {
    renderAppTitleBar(<AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} />);

    const settingsButton = screen.getByRole('button', { name: 'Settings' });
    expect(settingsButton.className).toContain('bg-transparent');
    expect(settingsButton.className).not.toContain('bg-[var(--color-brand-azure)]');
  });

  it('shows the demo mode badge under the title when demo mode is active', () => {
    renderAppTitleBar(<AppTitleBar {...baseProps} isOnline demoModeActive onLogout={jest.fn()} />);

    const badge = screen.getByTestId('demo-mode-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.tagName).toBe('SPAN');
    expect(badge.className).toContain('font-label');
    expect(badge.className).toContain('uppercase');
    expect(badge.className).toContain('--color-status-info-text');
    expect(badge.className).not.toContain('--color-status-info-strong-surface');
    expect(badge.className).not.toContain('--color-status-info-border');
    expect(badge.className).not.toContain('border');
    expect(screen.getByText('Sumurai').parentElement).toContainElement(badge);

    const actions = screen.getByRole('status', { name: 'Online' }).closest('div');
    expect(actions).not.toContainElement(badge);
  });

  it('hides the demo mode badge when demo mode is inactive', () => {
    renderAppTitleBar(
      <AppTitleBar {...baseProps} isOnline demoModeActive={false} onLogout={jest.fn()} />
    );

    expect(screen.queryByText('Demo mode')).not.toBeInTheDocument();
  });

  it('renders settings and logout actions for authenticated users', async () => {
    const onTabChange = jest.fn();
    const user = userEvent.setup();

    renderAppTitleBar(
      <AppTitleBar {...baseProps} isOnline onLogout={jest.fn()} onTabChange={onTabChange} />
    );

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Log off' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onTabChange).toHaveBeenCalledWith('settings');
  });

  it('navigates to dashboard when the logo is clicked', async () => {
    const onTabChange = jest.fn();
    const user = userEvent.setup();

    renderAppTitleBar(
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

  describe('unauthenticated auth layout', () => {
    it('always renders the Sumurai logo and wordmark', () => {
      renderAppTitleBar(<AppTitleBar state="unauthenticated" scrolled={false} isOnline />);

      expect(screen.getByAltText('Sumurai Logo')).toBeInTheDocument();
      expect(screen.getByText('Sumurai')).toBeInTheDocument();
    });

    it('keeps the logo left-aligned in the title bar grid', () => {
      renderAppTitleBar(<AppTitleBar state="unauthenticated" scrolled={false} isOnline />);

      const logoSlot = screen.getByAltText('Sumurai Logo').closest('.col-start-1');
      expect(logoSlot?.className).toContain('col-start-1');
      expect(logoSlot?.className).not.toContain('max-lg:absolute');
      expect(logoSlot?.className).not.toContain('max-lg:justify-center');
    });

    it('anchors the connectivity indicator to the right on tablet and mobile', () => {
      renderAppTitleBar(<AppTitleBar state="unauthenticated" scrolled={false} isOnline />);

      const actions = screen.getByRole('status', { name: 'Online' }).closest('div');
      expect(actions?.className).toContain('col-start-2');
      expect(actions?.className).toContain('justify-end');
      expect(actions?.className).not.toContain('max-lg:z-10');
    });
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
      renderAppTitleBar(<AppTitleBar {...mobileProps} />);
      expect(screen.getByRole('banner').className).toContain('pt-[env(safe-area-inset-top)]');
    });

    it('online connectivity icon is always present (no responsive hiding)', () => {
      renderAppTitleBar(<AppTitleBar {...mobileProps} />);
      const indicator = screen.getByRole('status', { name: 'Online' });
      expect(indicator).toBeInTheDocument();
      expect(indicator.className).not.toContain('hidden');
    });

    it('sizes the connectivity indicator to match action icon buttons', () => {
      renderAppTitleBar(<AppTitleBar {...mobileProps} />);

      const indicator = screen.getByRole('status', { name: 'Online' });
      expect(indicator.className).toContain(control.square.md);
      expect(indicator.querySelector('span')?.className).toContain(control.glyph.md);

      const settingsButton = screen.getByRole('button', { name: 'Settings' });
      expect(settingsButton.className).toContain(control.square.md);
      expect(settingsButton.querySelector('span')?.className).toContain(control.glyph.md);
    });

    it('uses a single-row title bar grid on mobile', () => {
      renderAppTitleBar(<AppTitleBar {...mobileProps} />);

      const grid = screen.getByRole('banner').querySelector('.grid');
      expect(grid?.className).toContain('grid-rows-1');
      expect(grid?.className).toContain('content-center');
    });

    it('renders a single icon-only logout action on mobile', () => {
      renderAppTitleBar(<AppTitleBar {...mobileProps} />);

      const logoutButton = screen.getByRole('button', { name: 'Log off' });
      expect(logoutButton.className).toContain('aspect-square');
      expect(logoutButton.className).toContain('px-0');
    });
  });
});
