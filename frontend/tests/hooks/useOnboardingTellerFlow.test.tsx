import { jest } from '@jest/globals';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import {
  type UseOnboardingTellerFlowResult,
  useOnboardingTellerFlow,
} from '@/hooks/useOnboardingTellerFlow';
import { resetTellerScriptStateForTests } from '@/hooks/useTellerConnect';

const onboardingTellerFlowRef = { current: null as UseOnboardingTellerFlowResult | null };

function OnboardingTellerMount({
  options,
}: {
  options: Parameters<typeof useOnboardingTellerFlow>[0];
}) {
  const flow = useOnboardingTellerFlow(options);
  onboardingTellerFlowRef.current = flow;
  return React.createElement(React.Fragment, null, flow.tellerConnectMount);
}

function renderOnboardingTellerMounted(options: Parameters<typeof useOnboardingTellerFlow>[0]) {
  onboardingTellerFlowRef.current = null;
  return render(React.createElement(OnboardingTellerMount, { options }));
}

const setup = jest.fn();
const openMock = jest.fn();

describe('useOnboardingTellerFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetTellerScriptStateForTests();
    openMock.mockReset();
    setup.mockReturnValue({ open: openMock, destroy: jest.fn() });
    Object.assign(window, {
      TellerConnect: { setup },
    });
  });

  afterEach(() => {
    delete window.TellerConnect;
  });

  it('does not pass application id to Teller connect until connect is initiated', async () => {
    renderOnboardingTellerMounted({
      applicationId: 'app-123',
      enabled: true,
      isOnline: true,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(setup).not.toHaveBeenCalled();
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

    expect(setup).not.toHaveBeenCalled();
  });

  it('opens Teller connect after connect is initiated when ready', async () => {
    renderOnboardingTellerMounted({
      applicationId: 'app-123',
      enabled: true,
      isOnline: true,
    });

    await act(async () => {
      await onboardingTellerFlowRef.current!.initiateConnection();
    });

    await waitFor(() => {
      expect(openMock).toHaveBeenCalled();
    });
  });

  it('shows popup guidance when Teller connect cannot open', async () => {
    openMock.mockImplementation(() => {
      throw new Error('popup blocked');
    });

    renderOnboardingTellerMounted({
      applicationId: 'app-123',
      enabled: true,
      isOnline: true,
    });

    await act(async () => {
      await onboardingTellerFlowRef.current!.initiateConnection();
    });

    await waitFor(() => {
      expect(onboardingTellerFlowRef.current!.error).toContain('ad blocker');
    });
  });

  it('cleans up Teller SDK state after a script load failure without retrying the same click', async () => {
    delete window.TellerConnect;
    const appendChildSpy = jest.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      const script = node as HTMLScriptElement;
      queueMicrotask(() => {
        script.dispatchEvent(new Event('error'));
      });
      return node;
    });

    renderOnboardingTellerMounted({
      applicationId: 'app-123',
      enabled: true,
      isOnline: true,
    });

    await act(async () => {
      await onboardingTellerFlowRef.current!.initiateConnection();
    });

    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(openMock).not.toHaveBeenCalled();
    expect(onboardingTellerFlowRef.current!.error).toContain('Teller Connect could not load');
  });

  it('tries a fresh Teller SDK script load when retrying from a user action', async () => {
    delete window.TellerConnect;
    const appendChildSpy = jest.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      const script = node as HTMLScriptElement;
      queueMicrotask(() => {
        script.dispatchEvent(new Event('error'));
      });
      return node;
    });

    renderOnboardingTellerMounted({
      applicationId: 'app-123',
      enabled: true,
      isOnline: true,
    });

    await act(async () => {
      await onboardingTellerFlowRef.current!.initiateConnection();
    });

    expect(onboardingTellerFlowRef.current!.error).toContain('Teller Connect could not load');

    await act(async () => {
      await onboardingTellerFlowRef.current!.retryConnection();
    });

    expect(appendChildSpy).toHaveBeenCalledTimes(2);
    expect(openMock).not.toHaveBeenCalled();
    appendChildSpy.mockRestore();
  });
});
