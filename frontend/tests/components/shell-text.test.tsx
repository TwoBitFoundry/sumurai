import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/Footer';
import { NetWorthOverTimeWidget } from '@/components/NetWorthOverTimeWidget';
import { PasswordChecker } from '@/components/PasswordChecker';
import { Toast } from '@/components/Toast';
import { ThemeProvider } from '@/context/ThemeContext';
import { BudgetToolbar } from '@/features/budgets/components/BudgetToolbar';
import { SessionExpiryModal } from '@/SessionManager';
import { designTokens } from '@/ui/tokens';

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
      designTokens.text.label
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
      designTokens.text.primary
    );
    expect(screen.getByText('1:05')).toHaveClass(designTokens.text.danger);
    expect(screen.getByText('Your session will expire in 2 minutes.')).toHaveClass(
      designTokens.text.muted
    );
  });

  it('uses semantic text roles in toast copy', () => {
    render(<Toast message="Saved successfully" onClose={jest.fn()} />);

    expect(screen.getByText('Saved successfully')).toHaveClass(designTokens.text.primary);
  });

  it('uses semantic text roles in the footer copy and links', () => {
    render(<Footer />);

    expect(screen.getByText('Built in the open with the community')).toHaveClass(
      designTokens.text.muted
    );
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveClass(designTokens.text.accent);
    expect(screen.getByRole('link', { name: 'Support' })).toHaveClass(designTokens.text.accent);
  });

  it('uses semantic text roles in the budget toolbar and net worth widget', () => {
    render(
      <ThemeProvider>
        <BudgetToolbar
          monthLabel="May 2026"
          loading
          isAdding={false}
          showAddButton={false}
          onPreviousMonth={jest.fn()}
          onNextMonth={jest.fn()}
          onCurrentMonth={jest.fn()}
          onAddBudget={jest.fn()}
        />
        <NetWorthOverTimeWidget />
      </ThemeProvider>
    );

    expect(screen.getByText('May 2026')).toHaveClass(designTokens.text.muted);
    expect(screen.getByText('Updating')).toHaveClass(designTokens.text.subtle);
    expect(screen.getByText('Net Worth Over Time')).toHaveClass(designTokens.text.muted);
  });
});
