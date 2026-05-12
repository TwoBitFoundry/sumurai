import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react';
import { errJson, installFetchRoutes } from '@tests/utils/fetchRoutes';
import React from 'react';
import { resetTellerScriptStateForTests } from '@/hooks/useTellerConnect';
import { type UseTellerLinkFlowResult, useTellerLinkFlow } from '@/hooks/useTellerLinkFlow';

type TellerLinkFlowOptions = Parameters<typeof useTellerLinkFlow>[0];

const tellerLinkFlowRef = { current: null as UseTellerLinkFlowResult | null };

function TellerLinkMountHost({ props }: { props: TellerLinkFlowOptions }) {
  const flow = useTellerLinkFlow(props);
  tellerLinkFlowRef.current = flow;
  return React.createElement(React.Fragment, null, flow.tellerConnectMount);
}

const setup = jest.fn();
const openMock = jest.fn();

describe('useTellerLinkFlow', () => {
  beforeEach(() => {
    resetTellerScriptStateForTests();
    jest.clearAllMocks();
    openMock.mockReset();
    setup.mockReturnValue({ open: openMock, destroy: jest.fn() });
    Object.assign(window, {
      TellerConnect: { setup },
    });
    installFetchRoutes({
      'GET /api/providers/status': {
        provider: 'plaid',
        connections: [],
      },
      'GET /api/providers/accounts': errJson(404, {
        message: 'not found',
      }),
      'GET /api/plaid/accounts': [
        {
          id: 'acc_1',
          name: 'Everyday Checking',
          account_type: 'depository',
          balance_current: 1250.5,
          mask: '0000',
          provider_connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
        },
        {
          id: 'acc_2',
          name: 'High-Yield Savings',
          account_type: 'depository',
          balance_current: 5000,
          mask: '1111',
          provider_connection_id: 'conn_1',
          institution_name: 'First Platypus Bank',
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    openMock.mockReset();
    delete window.TellerConnect;
  });

  it('rebuilds Teller connections from cached accounts when status has none', async () => {
    const { result } = renderHook(() =>
      useTellerLinkFlow({
        applicationId: 'app_123',
        enabled: true,
        isOnline: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.connections).toHaveLength(1);
    expect(result.current.connections[0].institutionName).toBe('First Platypus Bank');
    expect(result.current.connections[0].accountCount).toBe(2);
    expect(result.current.connections[0].accounts).toHaveLength(2);
  });

  it('does not surface a load error when there are no Teller connections', async () => {
    installFetchRoutes({
      'GET /api/providers/status': {
        provider: 'teller',
        connections: [],
      },
      'GET /api/providers/accounts': [],
    });

    const { result } = renderHook(() =>
      useTellerLinkFlow({
        applicationId: 'app_123',
        enabled: true,
        isOnline: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.connections).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('does not pass application id to Teller connect until connect runs', async () => {
    tellerLinkFlowRef.current = null;
    render(
      React.createElement(TellerLinkMountHost, {
        props: { applicationId: 'app_123', enabled: true, isOnline: true },
      })
    );

    await waitFor(() => {
      expect(tellerLinkFlowRef.current!.loading).toBe(false);
    });

    expect(setup).not.toHaveBeenCalled();
  });

  it('given offline when connect runs then does not arm Teller with application id', async () => {
    const { result } = renderHook(() =>
      useTellerLinkFlow({
        applicationId: 'app_123',
        enabled: true,
        isOnline: false,
      })
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(setup).not.toHaveBeenCalled();
  });
});
