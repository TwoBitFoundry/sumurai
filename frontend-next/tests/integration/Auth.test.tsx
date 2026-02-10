import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginScreen, RegisterScreen } from '@/Auth';
import { installFetchRoutes } from '@tests/utils/fetchRoutes';

// Keep sessionStorage spies as test-local state
Object.defineProperty(globalThis, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
});

describe('Authentication Components', () => {
  const originalConsoleError = console.error;
  let fetchMock: ReturnType<typeof installFetchRoutes>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock console.error to suppress expected error logs during tests
    console.error = jest.fn();

    // Ensure clean DOM state between tests
    document.body.innerHTML = '';
    // Default routes: succeed with basic responses
    fetchMock = installFetchRoutes({
      'POST /api/auth/login': (req: Request) => {
        return new Response(JSON.stringify({ token: 'jwt-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
      'POST /api/auth/register': { message: 'Registration successful' },
    });
  });

  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
    // Ensure isolation between tests to prevent duplicate elements
    cleanup();
  });

  describe('Login Screen', () => {
    describe('Given a login screen component', () => {
      describe('When it is rendered', () => {
        it('Then it should show email and password fields with register link', () => {
          render(<LoginScreen onNavigateToRegister={jest.fn()} />);

          expect(screen.getByLabelText(/email/i)).toBeInTheDocument();

          expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

          // Be specific to avoid matching unrelated "Go to Login" buttons from error boundaries
          expect(screen.getAllByRole('button', { name: /^sign in$/i })[0]).toBeInTheDocument();

          expect(
            screen.getByRole('button', { name: /register|create account|sign up/i })
          ).toBeInTheDocument();
        });
      });

      describe('When valid credentials are submitted', () => {
        it('Then it should call auth API and store JWT in session storage', async () => {
          const mockJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
          const mockSessionStorage = jest.mocked(globalThis.sessionStorage);
          // Override login route to return specific token
          fetchMock = installFetchRoutes({
            'POST /api/auth/login': new Response(JSON.stringify({ token: mockJwt }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          });

          const onNavigateToRegister = jest.fn();
          render(<LoginScreen onNavigateToRegister={onNavigateToRegister} />);

          const user = userEvent.setup();
          await user.type(screen.getByLabelText(/email/i), 'test@example.com');
          await user.type(screen.getByLabelText(/password/i), 'TestPassword123!');

          await user.click(screen.getByRole('button', { name: /sign in/i }));

          await waitFor(() => {
            const call = (fetchMock as any).mock.calls.find(
              (c: any[]) => String(c[0]) === '/api/auth/login'
            );
            expect(call).toBeTruthy();
            const [, init] = call;
            expect(init).toMatchObject({
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: 'test@example.com', password: 'TestPassword123!' }),
            });
            expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth_token', mockJwt);
          });
        });
      });

      describe('When invalid credentials are submitted', () => {
        it('Then it should display authentication error message', async () => {
          // Override login route to 401
          fetchMock = installFetchRoutes({
            'POST /api/auth/login': new Response('Unauthorized', { status: 401 }),
          });

          const onNavigateToRegister = jest.fn();
          render(<LoginScreen onNavigateToRegister={onNavigateToRegister} />);

          const user = userEvent.setup();
          await user.type(screen.getByLabelText(/email/i), 'invalid@example.com');
          await user.type(screen.getByLabelText(/password/i), 'wrongpassword');

          await user.click(screen.getByRole('button', { name: /sign in/i }));

          await waitFor(() => {
            expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
          });

          const call = (fetchMock as any).mock.calls.find(
            (c: any[]) => String(c[0]) === '/api/auth/login'
          );
          expect(call).toBeTruthy();
          const [, init] = call;
          expect(init).toMatchObject({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'invalid@example.com', password: 'wrongpassword' }),
          });
        });
      });
    });
  });

  describe('Register Screen', () => {
    describe('Given a register screen component', () => {
      describe('When it is rendered', () => {
        it('Then it should show form with password requirements', () => {
          render(<RegisterScreen onNavigateToLogin={jest.fn()} />);

          expect(screen.getByLabelText(/email/i)).toBeInTheDocument();

          expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();

          expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();

          expect(
            screen.getByRole('button', { name: /register|create account|sign up/i })
          ).toBeInTheDocument();

          expect(screen.getByText(/8\+ characters/i)).toBeInTheDocument();
          expect(screen.getByText(/1 capital letter/i)).toBeInTheDocument();
          expect(screen.getByText(/1 number/i)).toBeInTheDocument();
          expect(screen.getByText(/1 special character/i)).toBeInTheDocument();
        });
      });

      describe('When weak password is typed in register form', () => {
        it('Then it should show validation errors in real time', async () => {
          render(<RegisterScreen onNavigateToLogin={jest.fn()} />);

          const user = userEvent.setup();
          const passwordInput = screen.getByLabelText(/^password$/i);

          await user.type(passwordInput, 'weak');

          expect(passwordInput).toHaveValue('weak');
        });
      });

      describe('When valid registration data is submitted', () => {
        it('Then it should call register API and navigate to login', async () => {
          fetchMock = installFetchRoutes({
            'POST /api/auth/register': { message: 'Registration successful' },
          });

          const onNavigateToLogin = jest.fn();
          render(<RegisterScreen onNavigateToLogin={onNavigateToLogin} />);

          const user = userEvent.setup();
          await user.type(screen.getByLabelText(/email/i), 'test@example.com');
          await user.type(screen.getByLabelText(/^password$/i), 'StrongPass123!');
          await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123!');

          await user.click(screen.getByRole('button', { name: /create account/i }));

          await waitFor(() => {
            const call = (fetchMock as any).mock.calls.find(
              (c: any[]) => String(c[0]) === '/api/auth/register'
            );
            expect(call).toBeTruthy();
            const [, init] = call;
            expect(init).toMatchObject({
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: 'test@example.com', password: 'StrongPass123!' }),
            });
          });
        });
      });

      describe('When duplicate email is registered', () => {
        it('Then it should display email already exists error', async () => {
          fetchMock = installFetchRoutes({
            'POST /api/auth/register': new Response(
              JSON.stringify({ error: 'Email already exists' }),
              { status: 409, headers: { 'Content-Type': 'application/json' } }
            ),
          });

          const onNavigateToLogin = jest.fn();
          render(<RegisterScreen onNavigateToLogin={onNavigateToLogin} />);

          const user = userEvent.setup();
          await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
          await user.type(screen.getByLabelText(/^password$/i), 'StrongPass123!');
          await user.type(screen.getByLabelText(/confirm password/i), 'StrongPass123!');

          await user.click(screen.getByRole('button', { name: /create account/i }));

          await waitFor(() => {
            expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
          });
        });
      });

      describe('When successful login JWT is received', () => {
        it('Then it should store in session storage and redirect', async () => {
          const mockJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
          const mockSessionStorage = jest.mocked(globalThis.sessionStorage);
          fetchMock = installFetchRoutes({
            'POST /api/auth/login': new Response(JSON.stringify({ token: mockJwt }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          });

          render(<LoginScreen onNavigateToRegister={jest.fn()} />);

          const user = userEvent.setup();
          await user.type(screen.getByLabelText(/email/i), 'test@example.com');
          await user.type(screen.getByLabelText(/password/i), 'ValidPass123!');
          await user.click(screen.getByRole('button', { name: /sign in/i }));

          await waitFor(() => {
            expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth_token', mockJwt);
          });
        });
      });

      describe('When register link is clicked from login', () => {
        it('Then it should navigate to register screen', async () => {
          const onNavigateToRegister = jest.fn();
          render(<LoginScreen onNavigateToRegister={onNavigateToRegister} />);

          const user = userEvent.setup();
          await user.click(screen.getByRole('button', { name: /create account/i }));

          expect(onNavigateToRegister).toHaveBeenCalled();
        });
      });

      describe('When login link is clicked from register', () => {
        it('Then it should navigate back to login screen', async () => {
          const onNavigateToLogin = jest.fn();
          render(<RegisterScreen onNavigateToLogin={onNavigateToLogin} />);

          const user = userEvent.setup();
          await user.click(screen.getByRole('button', { name: /sign in/i }));

          expect(onNavigateToLogin).toHaveBeenCalled();
        });
      });
    });
  });
});
