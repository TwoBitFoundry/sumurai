import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import {
  TellerConnectSdk,
  type TellerConnectSdkHandle,
} from '@/features/teller/components/TellerConnectSdk';
import type { TellerConnectGateway } from '@/hooks/useTellerConnect';
import { resetTellerScriptStateForTests } from '@/hooks/useTellerConnect';

describe('TellerConnectSdk', () => {
  const setup = jest.fn();
  const open = jest.fn();
  const destroy = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    resetTellerScriptStateForTests();
    setup.mockReturnValue({ open, destroy });
    Object.assign(window, {
      TellerConnect: {
        setup,
      },
    });
  });

  afterEach(() => {
    cleanup();
    delete window.TellerConnect;
    jest.restoreAllMocks();
  });

  const createGateway = (): TellerConnectGateway => ({
    storeEnrollment: jest.fn().mockResolvedValue({
      connection_id: 'conn-1',
      institution_name: 'Sample Bank',
    }),
    syncTransactions: jest.fn().mockResolvedValue(undefined),
  });

  it('initializes Teller Connect and exposes open callback', async () => {
    const gateway = createGateway();
    const ref = createRef<TellerConnectSdkHandle>();
    const { unmount } = render(
      <TellerConnectSdk ref={ref} applicationId="app-123" gateway={gateway} />
    );

    await waitFor(() => expect(ref.current?.getReady()).toBe(true));
    expect(setup).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-123',
        products: ['balance', 'transactions'],
      })
    );

    act(() => {
      ref.current?.open();
    });

    expect(open).toHaveBeenCalledTimes(1);
    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('stores enrollment and notifies caller on success', async () => {
    const gateway = createGateway();
    const onConnected = jest.fn();
    const ref = createRef<TellerConnectSdkHandle>();
    render(
      <TellerConnectSdk
        ref={ref}
        applicationId="app-123"
        gateway={gateway}
        onConnected={onConnected}
      />
    );

    await waitFor(() => expect(setup).toHaveBeenCalled());

    const config = setup.mock.calls[0][0];
    await config.onSuccess({
      accessToken: 'access-token',
      user: { id: 'user-1' },
      enrollment: {
        id: 'enroll-1',
        institution: {
          name: 'Sample Bank',
        },
      },
    });

    expect(gateway.storeEnrollment).toHaveBeenCalledWith({
      access_token: 'access-token',
      enrollment_id: 'enroll-1',
      institution_name: 'Sample Bank',
    });
    expect(gateway.syncTransactions).not.toHaveBeenCalled();
    expect(onConnected).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      institutionName: 'Sample Bank',
    });
  });

  it('injects Teller SDK script without crossorigin so execution does not require ACAO', async () => {
    delete window.TellerConnect;

    const appendChildSpy = jest
      .spyOn(document.head, 'appendChild')
      .mockImplementation((node) => node);
    render(
      <TellerConnectSdk ref={createRef()} applicationId="app-123" gateway={createGateway()} />
    );

    await waitFor(() => expect(appendChildSpy).toHaveBeenCalled());

    const script = appendChildSpy.mock.calls[0][0] as HTMLScriptElement;
    expect(script.hasAttribute('crossorigin')).toBe(false);
    expect(script.async).toBe(false);

    Object.assign(window, {
      TellerConnect: {
        setup,
      },
    });
    script.dispatchEvent(new Event('load'));

    await waitFor(() => expect(setup).toHaveBeenCalled());
  });

  it('reports a loaded Teller script without a global as a script load failure', async () => {
    delete window.TellerConnect;
    const staleScript = document.createElement('script');
    staleScript.src = 'https://cdn.teller.io/connect/connect.js';
    staleScript.dataset.loaded = 'true';
    staleScript.setAttribute('data-teller-connect', 'true');
    document.head.appendChild(staleScript);

    const appendChildSpy = jest
      .spyOn(document.head, 'appendChild')
      .mockImplementation((node) => node);
    const onScriptLoadFailed = jest.fn();
    render(
      <TellerConnectSdk
        ref={createRef()}
        applicationId="app-123"
        gateway={createGateway()}
        onScriptLoadFailed={onScriptLoadFailed}
      />
    );

    await waitFor(() => expect(onScriptLoadFailed).toHaveBeenCalled());
    expect(appendChildSpy).not.toHaveBeenCalled();
    expect(staleScript.isConnected).toBe(true);
  });

  it('removes stale Teller iframe DOM on unmount', async () => {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://teller.io/connect/app_123';
    iframe.id = 'teller-connect-window';
    document.body.style.overflow = 'hidden';
    document.body.dataset.providerSdkInset = 'active';
    document.body.appendChild(iframe);

    const { unmount } = render(
      <TellerConnectSdk ref={createRef()} applicationId="app-123" gateway={createGateway()} />
    );

    await waitFor(() => expect(setup).toHaveBeenCalled());

    unmount();

    expect(document.querySelector('iframe[src*="teller.io/connect"]')).toBeNull();
    expect(document.querySelector('#teller-connect-window')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.body.dataset.providerSdkInset).toBeUndefined();
  });
});
