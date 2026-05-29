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
      password_available: false,
    });
    const user = userEvent.setup();
    render(<LoginScreen onNavigateToRegister={jest.fn()} />);
    await user.type(screen.getByLabelText(/^email$/i), 'nobody@example.com');
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByText(/no account found for this email/i)).toBeTruthy();
    expect(screen.queryByLabelText(/^password$/i)).toBeNull();
  });

  it('opens recovery enrollment when login begin has no passkey and no password', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const { PasskeyService } = await import('@/services/passkeyService');
    jest.spyOn(PasskeyService, 'beginLogin').mockResolvedValue({
      session_id: 'recovery-session',
      challenge: { publicKey: { challenge: 'AQID', rp: { id: 'localhost', name: 'Sumurai' } } },
      account_exists: true,
      passkey_available: false,
      password_available: false,
    });
    const onRecoveryEnrollmentStarted = jest.fn();
    const user = userEvent.setup();
    render(
      <LoginScreen
        onNavigateToRegister={jest.fn()}
        onRecoveryEnrollmentStarted={onRecoveryEnrollmentStarted}
      />
    );
    await user.type(screen.getByLabelText(/^email$/i), 'recovery@example.com');
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(onRecoveryEnrollmentStarted).toHaveBeenCalledWith({
      email: 'recovery@example.com',
      sessionId: 'recovery-session',
      challenge: { publicKey: { challenge: 'AQID', rp: { id: 'localhost', name: 'Sumurai' } } },
    });
  });

  it('locks email while passkey enrollment is in progress', () => {
    render(<LoginScreen onNavigateToRegister={jest.fn()} lockedEmail="locked@example.com" />);
    const emailInput = screen.getByLabelText(/^email$/i) as HTMLInputElement;
    expect(emailInput.value).toBe('locked@example.com');
    expect(emailInput).toHaveProperty('readOnly', true);
    expect(screen.getByRole('button', { name: /^continue$/i })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /create account/i })).toHaveProperty(
      'disabled',
      true
    );
  });

  it('shows password step when login begin reports no passkey but password is available', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const { PasskeyService } = await import('@/services/passkeyService');
    jest.spyOn(PasskeyService, 'beginLogin').mockResolvedValue({
      session_id: '',
      challenge: {},
      account_exists: true,
      passkey_available: false,
      password_available: true,
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
    expect(container.querySelector('.lg\\:max-w-lg')).toBeTruthy();
  });

  it('starts legacy password migration enrollment after password sign-in', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const { PasskeyService } = await import('@/services/passkeyService');
    const { AuthService } = await import('@/services/authService');
    jest.spyOn(PasskeyService, 'beginLogin').mockResolvedValue({
      session_id: '',
      challenge: {},
      account_exists: true,
      passkey_available: false,
      password_available: true,
    });
    jest.spyOn(AuthService, 'loginWithPassword').mockResolvedValue({
      user_id: 'legacy-user',
      expires_at: '2099-01-01T00:00:00Z',
      onboarding_completed: true,
    });
    const onEnrollmentRequired = jest.fn();
    const user = userEvent.setup();
    render(
      <LoginScreen onNavigateToRegister={jest.fn()} onEnrollmentRequired={onEnrollmentRequired} />
    );
    await user.type(screen.getByLabelText(/^email$/i), 'legacy@example.com');
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await user.type(screen.getByLabelText(/^password$/i), 'Test1234!');
    await user.click(screen.getByRole('button', { name: /sign in with password/i }));
    expect(onEnrollmentRequired).toHaveBeenCalledWith(
      {
        user_id: 'legacy-user',
        expires_at: '2099-01-01T00:00:00Z',
        onboarding_completed: true,
      },
      'legacy@example.com'
    );
  });
});
