import './useOnboardingTellerFlow.jest-mock-setup';
import { jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useOnboardingTellerFlow } from '@/hooks/useOnboardingTellerFlow';

const openMock = jest.fn();

function getUseTellerConnectMock(): jest.Mock {
  return (jest.requireMock('@/hooks/useTellerConnect') as { useTellerConnect: jest.Mock })
    .useTellerConnect;
}

describe('useOnboardingTellerFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    openMock.mockReset();
    getUseTellerConnectMock().mockImplementation((opts: { applicationId: string }) => ({
      ready: Boolean(opts.applicationId),
      open: openMock,
    }));
  });

  it('does not pass application id to Teller connect until connect is initiated', () => {
    renderHook(() =>
      useOnboardingTellerFlow({
        applicationId: 'app-123',
        enabled: true,
        isOnline: true,
      })
    );

    expect(getUseTellerConnectMock()).toHaveBeenCalled();
    expect(getUseTellerConnectMock().mock.calls[0][0]).toMatchObject({ applicationId: '' });
  });

  it('given offline when connect initiated then does not arm Teller connect', async () => {
    const { result } = renderHook(() =>
      useOnboardingTellerFlow({
        applicationId: 'app-123',
        enabled: true,
        isOnline: false,
      })
    );

    await act(async () => {
      await result.current.initiateConnection();
    });

    expect(getUseTellerConnectMock().mock.calls.every((c) => c[0].applicationId === '')).toBe(true);
  });

  it('opens Teller connect after connect is initiated when ready', async () => {
    const { result } = renderHook(() =>
      useOnboardingTellerFlow({
        applicationId: 'app-123',
        enabled: true,
        isOnline: true,
      })
    );

    await act(async () => {
      await result.current.initiateConnection();
    });

    await waitFor(() => {
      expect(openMock).toHaveBeenCalled();
    });
  });

  it('shows popup guidance when Teller connect cannot open', async () => {
    openMock.mockImplementation(() => {
      throw new Error('popup blocked');
    });

    const { result } = renderHook(() =>
      useOnboardingTellerFlow({
        applicationId: 'app-123',
        enabled: true,
        isOnline: true,
      })
    );

    await act(async () => {
      await result.current.initiateConnection();
    });

    await waitFor(() => {
      expect(result.current.error).toContain('ad blocker');
    });
  });
});
