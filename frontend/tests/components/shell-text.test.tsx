import '../mocks/rechartsStub';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/Footer';
import { NetWorthOverTimeWidget } from '@/components/NetWorthOverTimeWidget';
import { PasswordChecker } from '@/components/PasswordChecker';
import { Toast } from '@/components/Toast';
import { ThemeProvider } from '@/context/ThemeContext';
import { BudgetToolbar } from '@/features/budgets/components/BudgetToolbar';
import { SessionExpiryModal } from '@/SessionManager';
import { text as uiTextRecipes } from '@/ui/recipes';

describe('shared shell text surfaces', () => {
  it('uses semantic text roles in the password checklist', () => {
    render(
      <PasswordChecker
        validation={{
          minLength: false,
          hasCapital: false,
          hasNumber: false,
          hasSpecial: false,
          isValid: false,
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Password checklist' })).toHaveClass(
      uiTextRecipes.label
    );
  });

  it('uses semantic text roles in the session expiry modal', () => {
    render(
      <SessionExpiryModal
        isOpen
        timeRemaining={65}
        onStayLoggedIn={jest.fn()}
        onLogout={jest.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Session expiring' })).toHaveClass(
      uiTextRecipes.primary
    );
    expect(screen.getByText('1:05')).toHaveClass(uiTextRecipes.danger);
    expect(screen.getByText('Your session will expire in 2 minutes.')).toHaveClass(
      uiTextRecipes.muted
    );
  });

  it('uses semantic text roles in toast copy', () => {
    render(<Toast message="Saved successfully" onClose={jest.fn()} />);

    expect(screen.getByText('Saved successfully')).toHaveClass(uiTextRecipes.primary);
  });

  it('renders toast above mobile chrome in a body portal', () => {
    render(<Toast message="Saved successfully" onClose={jest.fn()} />);

    const toast = screen.getByRole('status');
    expect(toast.parentElement).toBe(document.body);
    expect(toast).toHaveClass('z-[60]');
    expect(toast).toHaveClass('bottom-[calc(5.75rem+env(safe-area-inset-bottom))]');
    expect(toast).toHaveClass('md:bottom-6');
  });

  it('uses semantic text roles in the footer copy and links', () => {
    render(<Footer />);

    expect(screen.getByText('Forging better systems for founders')).toHaveClass(
      uiTextRecipes.muted
    );
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveClass(uiTextRecipes.accent);
    expect(screen.getByRole('link', { name: 'Support' })).toHaveClass(uiTextRecipes.accent);
  });

  it('uses semantic text roles in the budget toolbar and net worth widget', () => {
    const { container } = render(
      <ThemeProvider>
        <BudgetToolbar
          loading
          isPickerOpen={false}
          addButtonRef={{ current: null }}
          onAddBudget={jest.fn()}
        />
        <NetWorthOverTimeWidget />
      </ThemeProvider>
    );

    expect(screen.getByText('Updating')).toHaveClass(uiTextRecipes.subtle);
    expect(screen.getByText('Net Worth Over Time')).toHaveClass(uiTextRecipes.muted);
    expect(container.querySelector('[data-accessibility-layer="false"]')).toBeTruthy();
    expect(container.querySelector('[data-cursor="false"]')).toBeTruthy();
  });
});
