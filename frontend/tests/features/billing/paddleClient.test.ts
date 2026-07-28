import type { Paddle, PaddleEventData } from '@paddle/paddle-js';
import { createPaddleClient } from '@/features/billing/paddleClient';

const checkoutEvent = (name: string, transactionId: string): PaddleEventData =>
  ({ name, data: { transaction_id: transactionId } }) as PaddleEventData;

const createHarness = () => {
  let eventCallback: ((event: PaddleEventData) => void) | undefined;
  const open = jest.fn();
  const paddle = { Checkout: { open } } as unknown as Paddle;
  const initialize = jest.fn(async (options) => {
    eventCallback = options?.eventCallback;
    return paddle;
  });

  return {
    boundary: createPaddleClient(initialize),
    initialize,
    open,
    emit(event: PaddleEventData) {
      eventCallback?.(event);
    },
  };
};

const handlers = () => ({
  onCompleted: jest.fn(),
  onClosed: jest.fn(),
  onError: jest.fn(),
});

describe('paddleClient', () => {
  it('initializes once and reuses the same token and environment', async () => {
    const harness = createHarness();
    const firstHandlers = handlers();

    await expect(
      harness.boundary.openOverlayCheckout({
        token: 'test_token',
        environment: 'sandbox',
        transactionId: 'txn_1',
        handlers: firstHandlers,
      })
    ).resolves.toEqual({ ok: true });
    harness.emit(checkoutEvent('checkout.closed', 'txn_1'));
    const secondHandlers = handlers();
    await harness.boundary.openOverlayCheckout({
      token: 'test_token',
      environment: 'sandbox',
      transactionId: 'txn_2',
      handlers: secondHandlers,
    });

    expect(harness.initialize).toHaveBeenCalledTimes(1);
    expect(harness.open).toHaveBeenNthCalledWith(1, {
      transactionId: 'txn_1',
      settings: { displayMode: 'overlay' },
    });
    expect(harness.open).toHaveBeenNthCalledWith(2, {
      transactionId: 'txn_2',
      settings: { displayMode: 'overlay' },
    });
  });

  it('passes sandbox explicitly and omits the environment in production', async () => {
    const sandbox = createHarness();
    await sandbox.boundary.openOverlayCheckout({
      token: 'sandbox_token',
      environment: 'sandbox',
      transactionId: 'txn_sandbox',
      handlers: handlers(),
    });

    expect(sandbox.initialize.mock.calls[0]?.[0]).toMatchObject({
      token: 'sandbox_token',
      environment: 'sandbox',
    });

    const production = createHarness();
    await production.boundary.openOverlayCheckout({
      token: 'production_token',
      environment: 'production',
      transactionId: 'txn_production',
      handlers: handlers(),
    });

    expect(production.initialize.mock.calls[0]?.[0]).toMatchObject({ token: 'production_token' });
    expect(production.initialize.mock.calls[0]?.[0]).not.toHaveProperty('environment');
  });

  it('routes only matching terminal events and ignores close after completion', async () => {
    const harness = createHarness();
    const sessionHandlers = handlers();
    await harness.boundary.openOverlayCheckout({
      token: 'test_token',
      environment: 'sandbox',
      transactionId: 'txn_active',
      handlers: sessionHandlers,
    });

    harness.emit(checkoutEvent('checkout.completed', 'txn_other'));
    expect(sessionHandlers.onCompleted).not.toHaveBeenCalled();

    const completed = checkoutEvent('checkout.completed', 'txn_active');
    harness.emit(completed);
    harness.emit(checkoutEvent('checkout.closed', 'txn_active'));

    expect(sessionHandlers.onCompleted).toHaveBeenCalledWith(completed);
    expect(sessionHandlers.onClosed).not.toHaveBeenCalled();
    expect(sessionHandlers.onError).not.toHaveBeenCalled();
  });

  it('routes matching closed and error events then clears late events', async () => {
    const closedHarness = createHarness();
    const closedHandlers = handlers();
    await closedHarness.boundary.openOverlayCheckout({
      token: 'test_token',
      environment: 'sandbox',
      transactionId: 'txn_closed',
      handlers: closedHandlers,
    });
    const closed = checkoutEvent('checkout.closed', 'txn_closed');
    closedHarness.emit(closed);
    closedHarness.emit(closed);
    expect(closedHandlers.onClosed).toHaveBeenCalledTimes(1);
    expect(closedHandlers.onClosed).toHaveBeenCalledWith(closed);

    const errorHarness = createHarness();
    const errorHandlers = handlers();
    await errorHarness.boundary.openOverlayCheckout({
      token: 'test_token',
      environment: 'sandbox',
      transactionId: 'txn_error',
      handlers: errorHandlers,
    });
    const error = checkoutEvent('checkout.error', 'txn_error');
    errorHarness.emit(error);
    errorHarness.emit(error);
    expect(errorHandlers.onError).toHaveBeenCalledTimes(1);
    expect(errorHandlers.onError).toHaveBeenCalledWith(error);
  });

  it('rejects a concurrent overlay and conflicting initialization', async () => {
    const harness = createHarness();
    await harness.boundary.openOverlayCheckout({
      token: 'test_token',
      environment: 'sandbox',
      transactionId: 'txn_active',
      handlers: handlers(),
    });

    await expect(
      harness.boundary.openOverlayCheckout({
        token: 'test_token',
        environment: 'sandbox',
        transactionId: 'txn_concurrent',
        handlers: handlers(),
      })
    ).resolves.toMatchObject({ ok: false });
    expect(harness.open).toHaveBeenCalledTimes(1);

    harness.emit(checkoutEvent('checkout.closed', 'txn_active'));
    await expect(
      harness.boundary.openOverlayCheckout({
        token: 'different_token',
        environment: 'production',
        transactionId: 'txn_conflict',
        handlers: handlers(),
      })
    ).resolves.toMatchObject({ ok: false });
    expect(harness.initialize).toHaveBeenCalledTimes(1);
  });

  it('reports initialization and checkout-open failures', async () => {
    const missingBoundary = createPaddleClient(jest.fn(async () => undefined));
    await expect(
      missingBoundary.openOverlayCheckout({
        token: 'test_token',
        environment: 'sandbox',
        transactionId: 'txn_missing',
        handlers: handlers(),
      })
    ).resolves.toMatchObject({ ok: false });

    const open = jest.fn(() => {
      throw new Error('open failed');
    });
    const failingBoundary = createPaddleClient(
      jest.fn(async () => ({ Checkout: { open } }) as unknown as Paddle)
    );
    await expect(
      failingBoundary.openOverlayCheckout({
        token: 'test_token',
        environment: 'sandbox',
        transactionId: 'txn_open',
        handlers: handlers(),
      })
    ).resolves.toMatchObject({ ok: false, error: expect.any(Error) });
  });
});
