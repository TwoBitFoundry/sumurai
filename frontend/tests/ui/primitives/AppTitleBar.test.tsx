import { render, screen } from '@testing-library/react';
import { AppTitleBar } from '@/ui/primitives/AppTitleBar';
import { status as uiStatusRecipes } from '@/ui/recipes';

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
});
