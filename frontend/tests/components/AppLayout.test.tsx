import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/context/ThemeContext';
import { AppLayout } from '@/layouts/AppLayout';

describe('AppLayout', () => {
  it('renders a custom account filter when renderAccountFilter is provided', () => {
    render(
      <ThemeProvider initialMode="light">
        <AppLayout
          currentTab="dashboard"
          onTabChange={() => {}}
          onLogout={() => {}}
          renderAccountFilter={() => <span data-testid="account-filter-stub">Accounts</span>}
        >
          <div>Body</div>
        </AppLayout>
      </ThemeProvider>
    );

    expect(screen.getByTestId('account-filter-stub')).toHaveTextContent('Accounts');
    expect(screen.getByText('Body')).toBeInTheDocument();
  });
});
