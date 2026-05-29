import { render, screen } from '@testing-library/react';
import { LoginScreen, RegisterScreen } from '@/Auth';

describe('Auth screens', () => {
  it('renders email step without password fields', () => {
    render(<LoginScreen onNavigateToRegister={jest.fn()} />);
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeTruthy();
  });

  it('shows an error when login begin reports unknown email', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const { PasskeyService } = await import('@/services/passkeyService');
    jest.spyOn(PasskeyService, 'beginLogin').mockResolvedValue({
      session_id: 'session-1',
      challenge: {},
      account_exists: false,
      passkey_available: false,
    });
    const user = userEvent.setup();
    render(<LoginScreen onNavigateToRegister={jest.fn()} />);
    await user.type(screen.getByLabelText(/^email$/i), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByText(/no account found for this email/i)).toBeTruthy();
    expect(screen.queryByLabelText(/^password$/i)).toBeNull();
  });

  it('shows password step when login begin reports no passkey', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const { PasskeyService } = await import('@/services/passkeyService');
    jest.spyOn(PasskeyService, 'beginLogin').mockResolvedValue({
      session_id: 'session-1',
      challenge: {},
      account_exists: true,
      passkey_available: false,
    });
    const user = userEvent.setup();
    render(<LoginScreen onNavigateToRegister={jest.fn()} />);
    await user.type(screen.getByLabelText(/^email$/i), 'legacy@example.com');
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(await screen.findByLabelText(/^password$/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in with password/i })).toBeTruthy();
  });

  it('renders register without password fields', () => {
    render(<RegisterScreen onNavigateToLogin={jest.fn()} />);
    expect(screen.getByLabelText(/^email$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^passkey name$/i)).toBeTruthy();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.getByRole('button', { name: /^create account$/i })).toBeTruthy();
  });

  it('keeps auth form layout padding on the md tier', () => {
    const { container } = render(<LoginScreen onNavigateToRegister={jest.fn()} />);
    expect(container.querySelector('.md\\:px-6')).toBeTruthy();
  });
});
