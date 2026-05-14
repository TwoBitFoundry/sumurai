import { render, screen } from '@testing-library/react';
import React from 'react';
import { AppTitleBar } from '@/ui/primitives/AppTitleBar';
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
    themeMode: 'light' as const,
    onThemeToggle: jest.fn(),
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
});
