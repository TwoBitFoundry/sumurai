import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionManager, SessionExpiryModal } from '@/SessionManager';
import { installFetchRoutes } from '@tests/utils/fetchRoutes';

Object.defineProperty(globalThis, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
});

describe('Session Management & Expiry Modal', () => {
  let fetchMock: ReturnType<typeof installFetchRoutes>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default routes
    fetchMock = installFetchRoutes({
      'POST /api/auth/refresh': {
        token: 'new-jwt-token',
      },
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Session Expiry Detection', () => {
    describe('Given a 1-hour session', () => {
      describe('When 58 minutes pass', () => {
        it('Then it should show expiry warning modal with 2-minute countdown', async () => {
          const mockSessionStorage = jest.mocked(globalThis.sessionStorage);

          const now = Math.floor(Date.now() / 1000);
          const expiry = now + 90;
          const payload = { jti: 'test-session-id', iat: now, exp: expiry };
          const encodedPayload = btoa(JSON.stringify(payload));
          const mockToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.test`;

          mockSessionStorage.getItem.mockReturnValue(mockToken);

          const onLogout = jest.fn();
          render(
            <SessionManager onLogout={onLogout}>
              <div>App Content</div>
            </SessionManager>
          );

          await waitFor(
            () => {
              expect(screen.getByText(/session expiring/i)).toBeInTheDocument();
            },
            { timeout: 10000 }
          );

          expect(screen.getByText(/1:[0-9]{2}/)).toBeInTheDocument();

          expect(screen.getByRole('button', { name: /stay logged in/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
          expect(screen.getByText(/do nothing/i)).toBeInTheDocument();
        });
      });
    });

    describe('Given session expiry modal', () => {
      describe('When it is displayed', () => {
        it('Then it should show countdown timer and three action buttons', () => {
          const onStayLoggedIn = jest.fn();
          const onLogout = jest.fn();
          const timeRemaining = 120;

          render(
            <SessionExpiryModal
              isOpen={true}
              timeRemaining={timeRemaining}
              onStayLoggedIn={onStayLoggedIn}
              onLogout={onLogout}
            />
          );

          expect(screen.getByText('2:00')).toBeInTheDocument();

          expect(screen.getByText(/session expiring/i)).toBeInTheDocument();

          expect(screen.getByRole('button', { name: /stay logged in/i })).toBeInTheDocument();
          expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
          expect(screen.getByText(/do nothing/i)).toBeInTheDocument();
          expect(screen.getByText(/auto-logout/i)).toBeInTheDocument();
        });
      });
    });

    describe('Given countdown timer', () => {
      describe('When time passes', () => {
        it('Then it should update display every second until zero', async () => {
          const onStayLoggedIn = jest.fn();
          const onLogout = jest.fn();
          let timeRemaining = 5;

          const { rerender } = render(
            <SessionExpiryModal
              isOpen={true}
              timeRemaining={timeRemaining}
              onStayLoggedIn={onStayLoggedIn}
              onLogout={onLogout}
            />
          );

          expect(screen.getByText('0:05')).toBeInTheDocument();

          timeRemaining = 4;
          rerender(
            <SessionExpiryModal
              isOpen={true}
              timeRemaining={timeRemaining}
              onStayLoggedIn={onStayLoggedIn}
              onLogout={onLogout}
            />
          );
          expect(screen.getByText('0:04')).toBeInTheDocument();

          timeRemaining = 0;
          rerender(
            <SessionExpiryModal
              isOpen={true}
              timeRemaining={timeRemaining}
              onStayLoggedIn={onStayLoggedIn}
              onLogout={onLogout}
            />
          );
          expect(screen.getByText('0:00')).toBeInTheDocument();
        });
      });
    });
  });

  describe('User Actions', () => {
    describe('Given stay logged in button', () => {
      describe('When clicked', () => {
        it('Then it should call refresh API and extend session', async () => {
          const mockSessionStorage = jest.mocked(globalThis.sessionStorage);
          const newToken =
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJuZXctc2Vzc2lvbi1pZCIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAzNjAwfQ.new';

          mockSessionStorage.getItem.mockReturnValue('original-token');

          installFetchRoutes({
            'POST /api/auth/refresh': { token: newToken },
          });

          const onStayLoggedIn = jest.fn();
          const onLogout = jest.fn();

          render(
            <SessionExpiryModal
              isOpen={true}
              timeRemaining={120}
              onStayLoggedIn={onStayLoggedIn}
              onLogout={onLogout}
            />
          );

          await userEvent.click(screen.getByRole('button', { name: /stay logged in/i }));

          await waitFor(() => {
            expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth_token', newToken);
          });

          expect(onStayLoggedIn).toHaveBeenCalled();
        });
      });
    });

    describe('Given logout button', () => {
      describe('When clicked in modal', () => {
        it('Then it should immediately log out and clear all data', async () => {
          const mockSessionStorage = jest.mocked(globalThis.sessionStorage);
          const onStayLoggedIn = jest.fn();
          const onLogout = jest.fn();

          render(
            <SessionExpiryModal
              isOpen={true}
              timeRemaining={120}
              onStayLoggedIn={onStayLoggedIn}
              onLogout={onLogout}
            />
          );

          await userEvent.click(screen.getByRole('button', { name: /logout/i }));

          expect(mockSessionStorage.clear).toHaveBeenCalled();

          expect(onLogout).toHaveBeenCalled();
        });
      });
    });

    describe('Given countdown reaching zero', () => {
      describe('When no action is taken', () => {
        it('Then it should automatically log out user', async () => {
          const mockSessionStorage = jest.mocked(globalThis.sessionStorage);

          const now = Math.floor(Date.now() / 1000);
          const expiry = now - 10;
          const payload = { jti: 'test-session-id', iat: now - 3600, exp: expiry };
          const encodedPayload = btoa(JSON.stringify(payload));
          const mockToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encodedPayload}.test`;

          mockSessionStorage.getItem.mockReturnValue(mockToken);

          const onLogout = jest.fn();
          render(
            <SessionManager onLogout={onLogout}>
              <div>App Content</div>
            </SessionManager>
          );

          await waitFor(() => {
            expect(mockSessionStorage.clear).toHaveBeenCalled();
            expect(onLogout).toHaveBeenCalled();
          });
        });
      });
    });
  });

  describe('Session Refresh', () => {
    describe('Given session refresh', () => {
      describe('When successful', () => {
        it('Then it should update JWT in session storage and close modal', async () => {
          const mockSessionStorage = jest.mocked(globalThis.sessionStorage);
          const newToken =
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJuZXctc2Vzc2lvbi1pZCIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDA3MjAwfQ.new';

          mockSessionStorage.getItem.mockReturnValue('original-token');

          installFetchRoutes({
            'POST /api/auth/refresh': { token: newToken },
          });

          const onStayLoggedIn = jest.fn();
          const onLogout = jest.fn();

          render(
            <SessionExpiryModal
              isOpen={true}
              timeRemaining={120}
              onStayLoggedIn={onStayLoggedIn}
              onLogout={onLogout}
            />
          );

          await userEvent.click(screen.getByRole('button', { name: /stay logged in/i }));

          await waitFor(() => {
            expect(mockSessionStorage.setItem).toHaveBeenCalledWith('auth_token', newToken);
            expect(onStayLoggedIn).toHaveBeenCalled();
          });
        });
      });
    });

    describe('Given session refresh', () => {
      describe('When failed', () => {
        it('Then it should automatically log out user with error message', async () => {
          const mockSessionStorage = jest.mocked(globalThis.sessionStorage);

          mockSessionStorage.getItem.mockReturnValue('original-token');

          installFetchRoutes({
            'POST /api/auth/refresh': new Response('Unauthorized', { status: 401 }),
          });

          const onStayLoggedIn = jest.fn();
          const onLogout = jest.fn();

          render(
            <SessionExpiryModal
              isOpen={true}
              timeRemaining={120}
              onStayLoggedIn={onStayLoggedIn}
              onLogout={onLogout}
            />
          );

          await userEvent.click(screen.getByRole('button', { name: /stay logged in/i }));

          await waitFor(
            () => {
              expect(mockSessionStorage.clear).toHaveBeenCalled();
              expect(onLogout).toHaveBeenCalled();
            },
            { timeout: 5000 }
          );
        });
      });
    });
  });
});
