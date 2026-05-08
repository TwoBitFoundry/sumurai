import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/Footer';
import { PasswordChecker } from '@/components/PasswordChecker';
import { Toast } from '@/components/Toast';
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
});
