import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionManager } from '@/SessionManager';
import { AuthenticationError } from '@/services/ApiClient';
import { AuthService } from '@/services/authService';

jest.mock('@/services/authService', () => ({
  AuthService: {
    refreshToken: jest.fn(),
    clearToken: jest.fn(),
  },
}));

describe('SessionManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the app mounted when the local session deadline has passed', () => {
    const onLogout = jest.fn();

    render(
      <SessionManager
        expiresAt={new Date(Date.now() - 1000).toISOString()}
        onSessionRefreshed={jest.fn()}
        onLogout={onLogout}
      >
        <div>App content</div>
      </SessionManager>
    );

    expect(screen.getByText('App content')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Session expired' })).toBeVisible();
    expect(onLogout).not.toHaveBeenCalled();
    expect(AuthService.clearToken).not.toHaveBeenCalled();
  });

  it('keeps the user signed in when a refresh attempt fails without an auth error', async () => {
    const user = userEvent.setup();
    const onLogout = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(AuthService.refreshToken).mockRejectedValue(new Error('Failed to fetch'));

    render(
      <SessionManager
        expiresAt={new Date(Date.now() + 60_000).toISOString()}
        onSessionRefreshed={jest.fn()}
        onLogout={onLogout}
      >
        <div>App content</div>
      </SessionManager>
    );

    await user.click(screen.getByRole('button', { name: 'Stay logged in' }));

    expect(onLogout).not.toHaveBeenCalled();
    expect(AuthService.clearToken).not.toHaveBeenCalled();
    expect(screen.getByText('App content')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Session expiring' })).toBeVisible();

    consoleError.mockRestore();
  });

  it('logs out when the refresh attempt confirms authentication failure', async () => {
    const user = userEvent.setup();
    const onLogout = jest.fn();
    jest.mocked(AuthService.refreshToken).mockRejectedValue(new AuthenticationError());

    render(
      <SessionManager
        expiresAt={new Date(Date.now() + 60_000).toISOString()}
        onSessionRefreshed={jest.fn()}
        onLogout={onLogout}
      >
        <div>App content</div>
      </SessionManager>
    );

    await user.click(screen.getByRole('button', { name: 'Stay logged in' }));

    expect(AuthService.clearToken).toHaveBeenCalled();
    expect(onLogout).toHaveBeenCalled();
  });
});
