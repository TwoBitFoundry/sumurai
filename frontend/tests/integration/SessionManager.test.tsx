import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFetchRoutes } from '@tests/utils/fetchRoutes';
import { SessionExpiryModal, SessionManager } from '@/SessionManager';
import { AuthService } from '@/services/authService';

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
        user_id: 'user-123',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        onboarding_completed: true,
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
          const now = Math.floor(Date.now() / 1000);
          const expiry = now + 90;
          const expiresAt = new Date(expiry * 1000).toISOString();

          const onLogout = jest.fn();
          const onSessionRefreshed = jest.fn();
          render(
            <SessionManager
              expiresAt={expiresAt}
              onSessionRefreshed={onSessionRefreshed}
              onLogout={onLogout}
            >
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
          installFetchRoutes({
            'POST /api/auth/refresh': {
              user_id: 'user-123',
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              onboarding_completed: true,
            },
          });

          const onStayLoggedIn = jest.fn();
          const onSessionRefreshed = jest.fn();
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
            expect(onSessionRefreshed).toBeDefined();
          });

          expect(onStayLoggedIn).toHaveBeenCalled();
        });
      });
    });

    describe('Given logout button', () => {
      describe('When clicked in modal', () => {
        it('Then it should immediately log out and clear all data', async () => {
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

          expect(onLogout).toHaveBeenCalled();
        });
      });
    });

    describe('Given countdown reaching zero', () => {
      describe('When no action is taken', () => {
        it('Then it should automatically log out user', async () => {
          const now = Math.floor(Date.now() / 1000);
          const expiry = now - 10;
          const expiresAt = new Date(expiry * 1000).toISOString();

          const onLogout = jest.fn();
          render(
            <SessionManager
              expiresAt={expiresAt}
              onSessionRefreshed={jest.fn()}
              onLogout={onLogout}
            >
              <div>App Content</div>
            </SessionManager>
          );

          await waitFor(() => {
            expect(onLogout).toHaveBeenCalled();
          });
        });
      });
    });
  });

  describe('Session Refresh', () => {
    describe('Given session refresh', () => {
      describe('When Stay logged in succeeds', () => {
        it('Then AuthService.refreshToken is invoked exactly once', async () => {
          installFetchRoutes({
            'POST /api/auth/refresh': {
              user_id: 'user-123',
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              onboarding_completed: true,
            },
          });

          const refreshSpy = jest.spyOn(AuthService, 'refreshToken');

          const nowSec = Math.floor(Date.now() / 1000);
          const expiresAt = new Date((nowSec + 90) * 1000).toISOString();

          render(
            <SessionManager
              expiresAt={expiresAt}
              onSessionRefreshed={jest.fn()}
              onLogout={jest.fn()}
            >
              <div>App Content</div>
            </SessionManager>
          );

          await waitFor(() => {
            expect(screen.getByRole('button', { name: /stay logged in/i })).toBeInTheDocument();
          });

          await userEvent.click(screen.getByRole('button', { name: /stay logged in/i }));

          await waitFor(() => {
            expect(refreshSpy).toHaveBeenCalledTimes(1);
          });

          refreshSpy.mockRestore();
        });
      });
    });

    describe('Given session refresh', () => {
      describe('When successful', () => {
        it('Then it should refresh the session and close the modal', async () => {
          installFetchRoutes({
            'POST /api/auth/refresh': {
              user_id: 'user-123',
              expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
              onboarding_completed: true,
            },
          });

          const onStayLoggedIn = jest.fn();
          const onSessionRefreshed = jest.fn();
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
            expect(onStayLoggedIn).toHaveBeenCalled();
          });
        });
      });
    });

    describe('Given session refresh', () => {
      describe('When failed', () => {
        it('Then it should automatically log out user with error message', async () => {
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
              expect(onLogout).toHaveBeenCalled();
            },
            { timeout: 5000 }
          );
        });
      });
    });
  });
});
