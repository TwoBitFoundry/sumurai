import {
  type InitializePaddleOptions,
  initializePaddle,
  type Paddle,
  type PaddleEventData,
} from '@paddle/paddle-js';
import type { PaddleEnvironment } from '@/types/api';

type PaddleInitializer = (options: InitializePaddleOptions) => Promise<Paddle | undefined>;

export interface PaddleOverlayHandlers {
  onCompleted: (event: PaddleEventData) => void;
  onClosed: (event: PaddleEventData) => void;
  onError: (event: PaddleEventData) => void;
}

export interface OpenOverlayCheckoutInput {
  token: string;
  environment: PaddleEnvironment;
  transactionId: string;
  handlers: PaddleOverlayHandlers;
}

export type PaddleCheckoutOpenResult = { ok: true } | { ok: false; error: Error };

interface PaddleConfiguration {
  token: string;
  environment: PaddleEnvironment;
}

interface ActiveSession {
  transactionId: string;
  handlers: PaddleOverlayHandlers;
}

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error('Paddle checkout failed');

const sameConfiguration = (first: PaddleConfiguration, second: PaddleConfiguration): boolean =>
  first.token === second.token && first.environment === second.environment;

export function createPaddleClient(initialize: PaddleInitializer = initializePaddle) {
  let initialization: Promise<Paddle | undefined> | undefined;
  let configuration: PaddleConfiguration | undefined;
  let activeSession: ActiveSession | undefined;

  const eventCallback = (event: PaddleEventData) => {
    const session = activeSession;
    if (!session) {
      return;
    }
    const transactionId = event.data?.transaction_id;
    const errorEvent =
      event.name === 'checkout.error' ||
      event.name === 'checkout.failed' ||
      event.name === 'checkout.payment.error' ||
      event.name === 'checkout.payment.failed';
    if (transactionId !== undefined && transactionId !== session.transactionId) {
      return;
    }
    if (!errorEvent && transactionId !== session.transactionId) {
      return;
    }

    if (event.name === 'checkout.completed') {
      activeSession = undefined;
      session.handlers.onCompleted(event);
      return;
    }
    if (event.name === 'checkout.closed') {
      activeSession = undefined;
      session.handlers.onClosed(event);
      return;
    }
    if (errorEvent) {
      activeSession = undefined;
      session.handlers.onError(event);
    }
  };

  const paddleFor = (nextConfiguration: PaddleConfiguration): Promise<Paddle | undefined> => {
    if (initialization) {
      return initialization;
    }
    configuration = nextConfiguration;
    const options: InitializePaddleOptions = {
      token: nextConfiguration.token,
      eventCallback,
      ...(nextConfiguration.environment === 'sandbox' ? { environment: 'sandbox' as const } : {}),
    };
    initialization = Promise.resolve()
      .then(() => initialize(options))
      .catch((error) => {
        initialization = undefined;
        configuration = undefined;
        throw error;
      });
    return initialization;
  };

  const openOverlayCheckout = async (
    input: OpenOverlayCheckoutInput
  ): Promise<PaddleCheckoutOpenResult> => {
    if (activeSession) {
      return { ok: false, error: new Error('A Paddle checkout is already open') };
    }
    const nextConfiguration = { token: input.token, environment: input.environment };
    if (configuration && !sameConfiguration(configuration, nextConfiguration)) {
      return {
        ok: false,
        error: new Error('Paddle is already initialized with a different configuration'),
      };
    }

    activeSession = { transactionId: input.transactionId, handlers: input.handlers };
    try {
      const paddle = await paddleFor(nextConfiguration);
      if (!paddle) {
        initialization = undefined;
        configuration = undefined;
        throw new Error('Paddle failed to initialize');
      }
      paddle.Checkout.open({
        transactionId: input.transactionId,
        settings: { displayMode: 'overlay' },
      });
      return { ok: true };
    } catch (error) {
      if (activeSession?.transactionId === input.transactionId) {
        activeSession = undefined;
      }
      return { ok: false, error: asError(error) };
    }
  };

  return { openOverlayCheckout };
}

const paddleClient = createPaddleClient();

export const openOverlayCheckout = paddleClient.openOverlayCheckout;
