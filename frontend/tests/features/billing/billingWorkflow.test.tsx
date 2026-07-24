import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  BillingWorkflowController,
  type BillingWorkflowGateway,
} from '@/features/billing/billingWorkflow';
import { BILLING_STATUS_QUERY_KEY } from '@/features/billing/useBillingStatus';
import { useBillingWorkflow } from '@/features/billing/useBillingWorkflow';
import { ConflictError, NetworkError, RateLimitError } from '@/services/ApiClient';
import type { BillingStatusResponse } from '@/types/api';

const billingStatus = (
  accessStatus: BillingStatusResponse['access_status'],
  paymentMethodRequired = false
): BillingStatusResponse => ({
  billing_enabled: true,
  trials_enabled: true,
  paddle_client_token: 'test_token',
  paddle_environment: 'sandbox',
  access_status: accessStatus,
  can_use_own_data: accessStatus === 'active' || accessStatus === 'trialing',
  is_demo_mode_active: false,
  trial_ends_at: null,
  current_period_ends_at: null,
  scheduled_cancel_at: null,
  payment_method_required: paymentMethodRequired,
  billing_portal_available: true,
  enabled_financial_providers: ['diy', 'plaid'],
});

const flushAsync = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const paddleConfig = { token: 'test_token', environment: 'sandbox' } as const;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

const createGateway = () => {
  let overlayHandlers:
    | Parameters<BillingWorkflowGateway['openOverlayCheckout']>[0]['handlers']
    | undefined;
  const gateway: BillingWorkflowGateway = {
    getStatus: jest.fn(),
    createCheckout: jest
      .fn()
      .mockResolvedValue({ checkout_url: 'https://checkout.test', transaction_id: 'txn_1' }),
    startTrial: jest.fn().mockResolvedValue({ status: 'pending' }),
    createPaymentMethodTransaction: jest
      .fn()
      .mockResolvedValue({ checkout_url: 'https://checkout.test', transaction_id: 'txn_2' }),
    openOverlayCheckout: jest.fn(async (input) => {
      overlayHandlers = input.handlers;
      return { ok: true } as const;
    }),
    cacheStatus: jest.fn(),
  };

  return {
    gateway,
    completed(transactionId = 'txn_1') {
      overlayHandlers?.onCompleted({
        name: 'checkout.completed',
        data: { transaction_id: transactionId },
      } as Parameters<NonNullable<typeof overlayHandlers>['onCompleted']>[0]);
    },
    closed(transactionId = 'txn_1') {
      overlayHandlers?.onClosed({
        name: 'checkout.closed',
        data: { transaction_id: transactionId },
      } as Parameters<NonNullable<typeof overlayHandlers>['onClosed']>[0]);
    },
  };
};

describe('BillingWorkflowController completion targets', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('activates premium checkout only on active status', async () => {
    const { gateway, completed } = createGateway();
    jest.mocked(gateway.getStatus).mockResolvedValue(billingStatus('active'));
    const controller = new BillingWorkflowController(gateway);

    await controller.startPremiumCheckout(paddleConfig);
    expect(controller.getState().status).toBe('checkout_open');
    completed();
    await flushAsync();

    expect(controller.getState().status).toBe('activated');
    expect(gateway.cacheStatus).toHaveBeenCalledWith(billingStatus('active'));
  });

  it('activates a cardless trial on trialing status', async () => {
    const { gateway } = createGateway();
    jest.mocked(gateway.getStatus).mockResolvedValue(billingStatus('trialing'));
    const controller = new BillingWorkflowController(gateway);

    await controller.startCardlessTrial({ country_code: 'US', postal_code: '78701' });

    expect(controller.getState().status).toBe('activated');
    expect(gateway.startTrial).toHaveBeenCalledWith({
      country_code: 'US',
      postal_code: '78701',
    });
  });

  it('does not activate trial payment setup from the starting trialing status', async () => {
    const { gateway, completed } = createGateway();
    jest
      .mocked(gateway.getStatus)
      .mockResolvedValueOnce(billingStatus('trialing', true))
      .mockResolvedValueOnce(billingStatus('trialing', false));
    const controller = new BillingWorkflowController(gateway);

    await controller.startTrialPaymentMethod(paddleConfig);
    completed('txn_2');
    await flushAsync();

    expect(controller.getState().status).toBe('waiting_activation');
    jest.advanceTimersByTime(2_000);
    await flushAsync();

    expect(controller.getState().status).toBe('activated');
  });

  it('activates past-due recovery only after status becomes active', async () => {
    const { gateway, completed } = createGateway();
    jest
      .mocked(gateway.getStatus)
      .mockResolvedValueOnce(billingStatus('past_due'))
      .mockResolvedValueOnce(billingStatus('active'));
    const controller = new BillingWorkflowController(gateway);

    await controller.startPastDueRecovery(paddleConfig);
    completed('txn_2');
    await flushAsync();

    expect(controller.getState().status).toBe('waiting_activation');
    jest.advanceTimersByTime(2_000);
    await flushAsync();

    expect(controller.getState().status).toBe('activated');
  });
});

describe('BillingWorkflowController lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('times out without declaring failure and retries polling without another checkout', async () => {
    const { gateway, completed } = createGateway();
    jest.mocked(gateway.getStatus).mockResolvedValue(billingStatus('past_due'));
    const controller = new BillingWorkflowController(gateway, {
      pollIntervalMs: 2_000,
      maxPollAttempts: 2,
    });

    await controller.startPremiumCheckout(paddleConfig);
    completed();
    await flushAsync();
    jest.advanceTimersByTime(2_000);
    await flushAsync();

    expect(controller.getState().status).toBe('timeout');
    jest.mocked(gateway.getStatus).mockResolvedValue(billingStatus('active'));
    await controller.retry();

    expect(controller.getState().status).toBe('activated');
    expect(gateway.createCheckout).toHaveBeenCalledTimes(1);
    expect(gateway.openOverlayCheckout).toHaveBeenCalledTimes(1);
  });

  it('returns to idle when closed before completion and ignores close after completion', async () => {
    const first = createGateway();
    const firstController = new BillingWorkflowController(first.gateway);
    await firstController.startPremiumCheckout(paddleConfig);
    first.closed();
    expect(firstController.getState().status).toBe('idle');
    expect(first.gateway.getStatus).not.toHaveBeenCalled();

    const pending = deferred<BillingStatusResponse>();
    const second = createGateway();
    jest.mocked(second.gateway.getStatus).mockReturnValue(pending.promise);
    const secondController = new BillingWorkflowController(second.gateway);
    await secondController.startPremiumCheckout(paddleConfig);
    second.completed();
    await flushAsync();
    second.closed();
    expect(secondController.getState().status).toBe('waiting_activation');

    pending.resolve(billingStatus('active'));
    await flushAsync();
    expect(secondController.getState().status).toBe('activated');
  });

  it('maps trial conflict, rate limit, SDK, and network failures distinctly', async () => {
    const conflict = createGateway();
    jest
      .mocked(conflict.gateway.startTrial)
      .mockRejectedValue(new ConflictError('Trial used', 'TRIAL_ALREADY_USED'));
    const conflictController = new BillingWorkflowController(conflict.gateway);
    await conflictController.startCardlessTrial({ country_code: 'US', postal_code: '78701' });
    expect(conflictController.getState().error?.kind).toBe('trial_already_used');

    const rateLimit = createGateway();
    jest.mocked(rateLimit.gateway.startTrial).mockRejectedValue(new RateLimitError());
    const rateController = new BillingWorkflowController(rateLimit.gateway);
    await rateController.startCardlessTrial({ country_code: 'US', postal_code: '78701' });
    expect(rateController.getState().error?.kind).toBe('rate_limited');

    const sdk = createGateway();
    jest
      .mocked(sdk.gateway.openOverlayCheckout)
      .mockResolvedValue({ ok: false, error: new Error('SDK failed') });
    const sdkController = new BillingWorkflowController(sdk.gateway);
    await sdkController.startPremiumCheckout(paddleConfig);
    expect(sdkController.getState().error?.kind).toBe('sdk');

    const network = createGateway();
    jest.mocked(network.gateway.getStatus).mockRejectedValue(new NetworkError());
    const networkController = new BillingWorkflowController(network.gateway);
    await networkController.startCardlessTrial({ country_code: 'US', postal_code: '78701' });
    expect(networkController.getState().error?.kind).toBe('network');
  });

  it('ignores stale callbacks and cache writes after cancellation or supersession', async () => {
    const pendingStatus = deferred<BillingStatusResponse>();
    const first = createGateway();
    jest.mocked(first.gateway.getStatus).mockReturnValue(pendingStatus.promise);
    const controller = new BillingWorkflowController(first.gateway);

    await controller.startPremiumCheckout(paddleConfig);
    first.completed();
    await flushAsync();
    controller.cancel();
    pendingStatus.resolve(billingStatus('active'));
    await flushAsync();

    expect(controller.getState().status).toBe('idle');
    expect(first.gateway.cacheStatus).not.toHaveBeenCalled();

    const pendingCheckout = deferred<{ checkout_url: string; transaction_id: string }>();
    const second = createGateway();
    jest.mocked(second.gateway.createCheckout).mockReturnValue(pendingCheckout.promise);
    jest.mocked(second.gateway.getStatus).mockResolvedValue(billingStatus('trialing'));
    const superseded = new BillingWorkflowController(second.gateway);
    const firstRun = superseded.startPremiumCheckout(paddleConfig);
    await superseded.startCardlessTrial({ country_code: 'US', postal_code: '78701' });
    pendingCheckout.resolve({ checkout_url: 'https://checkout.test', transaction_id: 'stale' });
    await firstRun;

    expect(superseded.getState().status).toBe('activated');
    expect(second.gateway.openOverlayCheckout).not.toHaveBeenCalled();
  });
});

describe('useBillingWorkflow', () => {
  it('cleans up polling on unmount and writes no later query data', async () => {
    jest.useFakeTimers();
    const { gateway } = createGateway();
    jest.mocked(gateway.getStatus).mockResolvedValue(billingStatus('past_due'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const services = {
      getStatus: gateway.getStatus,
      createCheckout: gateway.createCheckout,
      startTrial: gateway.startTrial,
      createPaymentMethodTransaction: gateway.createPaymentMethodTransaction,
      openOverlayCheckout: gateway.openOverlayCheckout,
    };
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useBillingWorkflow({ services }), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.startCardlessTrial({ country_code: 'US', postal_code: '78701' });
    });
    expect(queryClient.getQueryData(BILLING_STATUS_QUERY_KEY)).toEqual(billingStatus('past_due'));
    unmount();

    act(() => {
      jest.advanceTimersByTime(120_000);
    });
    await flushAsync();

    expect(gateway.getStatus).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(BILLING_STATUS_QUERY_KEY)).toEqual(billingStatus('past_due'));
    jest.useRealTimers();
  });
});
