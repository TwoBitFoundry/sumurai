import { act, cleanup, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { PlaidLinkSdk, type PlaidLinkSdkHandle } from '@/features/plaid/components/PlaidLinkSdk';
import { resetPlaidScriptStateForTests } from '@/features/plaid/plaidLinkScript';

describe('PlaidLinkSdk', () => {
  const create = jest.fn();
  const open = jest.fn();
  const destroy = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    resetPlaidScriptStateForTests();
    create.mockReturnValue({
      open,
      destroy,
      exit: (_options?: unknown, callback?: () => void) => {
        callback?.();
      },
    });
    Object.assign(window, {
      Plaid: {
        create,
      },
    });
  });

  afterEach(() => {
    cleanup();
    delete window.Plaid;
    document
      .querySelectorAll(
        'script[data-plaid-link], script[src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"]'
      )
      .forEach((script) => {
        script.remove();
      });
    jest.restoreAllMocks();
  });

  it('initializes Plaid Link and exposes open callback', async () => {
    const ref = createRef<PlaidLinkSdkHandle>();
    const { unmount } = render(
      <PlaidLinkSdk
        ref={ref}
        token="link-token"
        onSuccess={jest.fn()}
        onExit={jest.fn()}
        onScriptLoadFailed={jest.fn()}
      />
    );

    await waitFor(() => expect(ref.current?.getReady()).toBe(true));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'link-token',
      })
    );

    act(() => {
      ref.current?.open();
    });

    expect(open).toHaveBeenCalledTimes(1);
    unmount();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('reports a loaded Plaid script without a global as a script load failure', async () => {
    delete window.Plaid;
    const staleScript = document.createElement('script');
    staleScript.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    staleScript.dataset.loaded = 'true';
    document.head.appendChild(staleScript);

    const appendChildSpy = jest
      .spyOn(document.head, 'appendChild')
      .mockImplementation((node) => node);
    const onScriptLoadFailed = jest.fn();
    render(
      <PlaidLinkSdk
        ref={createRef()}
        token="link-token"
        onSuccess={jest.fn()}
        onExit={jest.fn()}
        onScriptLoadFailed={onScriptLoadFailed}
      />
    );

    await waitFor(() => expect(onScriptLoadFailed).toHaveBeenCalled());
    expect(appendChildSpy).not.toHaveBeenCalled();
    expect(staleScript.isConnected).toBe(true);
  });
});
