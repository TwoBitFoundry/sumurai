import { ApiError, ConflictError, NetworkError, RateLimitError } from '@/services/ApiClient';
import type {
  BillingCheckoutResponse,
  BillingStatusResponse,
  BillingTrialStartRequest,
  BillingTrialStartResponse,
} from '@/types/api';
import type { OpenOverlayCheckoutInput, PaddleCheckoutOpenResult } from './paddleClient';

export type BillingWorkflowStatus =
  | 'idle'
  | 'creating'
  | 'checkout_open'
  | 'waiting_activation'
  | 'activated'
  | 'timeout'
  | 'error';

export type BillingWorkflowErrorKind =
  | 'trial_already_used'
  | 'rate_limited'
  | 'sdk'
  | 'network'
  | 'request';

export interface BillingWorkflowError {
  kind: BillingWorkflowErrorKind;
  message: string;
  cause: unknown;
}

export interface BillingWorkflowState {
  status: BillingWorkflowStatus;
  error?: BillingWorkflowError;
  billingStatus?: BillingStatusResponse;
}

export interface BillingWorkflowGateway {
  getStatus: () => Promise<BillingStatusResponse>;
  createCheckout: () => Promise<BillingCheckoutResponse>;
  startTrial: (request: BillingTrialStartRequest) => Promise<BillingTrialStartResponse>;
  createPaymentMethodTransaction: () => Promise<BillingCheckoutResponse>;
  openOverlayCheckout: (input: OpenOverlayCheckoutInput) => Promise<PaddleCheckoutOpenResult>;
  cacheStatus: (status: BillingStatusResponse) => void;
}

export interface BillingWorkflowTiming {
  pollIntervalMs: number;
  maxPollAttempts: number;
}

export interface BillingWorkflowPaddleConfig {
  token: string;
  environment: OpenOverlayCheckoutInput['environment'];
}

type CompletionTarget =
  | 'premium_checkout'
  | 'cardless_trial'
  | 'trial_payment_method'
  | 'past_due_recovery';

const defaultTiming: BillingWorkflowTiming = {
  pollIntervalMs: 2_000,
  maxPollAttempts: 60,
};

const idleState = (): BillingWorkflowState => ({ status: 'idle' });

const targetReached = (target: CompletionTarget, status: BillingStatusResponse): boolean => {
  if (target === 'cardless_trial') {
    return status.access_status === 'trialing';
  }
  if (target === 'trial_payment_method') {
    return (
      status.access_status === 'active' ||
      (status.access_status === 'trialing' && !status.payment_method_required)
    );
  }
  return status.access_status === 'active';
};

const requestError = (error: unknown): BillingWorkflowError => {
  if (error instanceof ConflictError && error.code === 'TRIAL_ALREADY_USED') {
    return { kind: 'trial_already_used', message: error.message, cause: error };
  }
  if (error instanceof RateLimitError || (error instanceof ApiError && error.status === 429)) {
    return { kind: 'rate_limited', message: error.message, cause: error };
  }
  if (
    error instanceof NetworkError ||
    (error instanceof ApiError && error.status === 0) ||
    error instanceof TypeError
  ) {
    return {
      kind: 'network',
      message: error instanceof Error ? error.message : 'Network connection failed',
      cause: error,
    };
  }
  return {
    kind: 'request',
    message: error instanceof Error ? error.message : 'Billing request failed',
    cause: error,
  };
};

export class BillingWorkflowController {
  private state = idleState();
  private listeners = new Set<() => void>();
  private runId = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryTarget: CompletionTarget | undefined;
  private disposed = false;
  private readonly timing: BillingWorkflowTiming;

  constructor(
    private readonly gateway: BillingWorkflowGateway,
    timing: Partial<BillingWorkflowTiming> = {}
  ) {
    this.timing = { ...defaultTiming, ...timing };
  }

  getState = (): BillingWorkflowState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private setState(state: BillingWorkflowState) {
    if (this.disposed) {
      return;
    }
    this.state = state;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private clearTimer() {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private beginRun(): number {
    this.clearTimer();
    this.runId += 1;
    this.retryTarget = undefined;
    this.setState({ status: 'creating' });
    return this.runId;
  }

  private isCurrent(runId: number): boolean {
    return !this.disposed && this.runId === runId;
  }

  private failRequest(runId: number, error: unknown) {
    if (this.isCurrent(runId)) {
      this.setState({ status: 'error', error: requestError(error) });
    }
  }

  private failSdk(runId: number, error: unknown) {
    if (!this.isCurrent(runId) || this.state.status !== 'checkout_open') {
      return;
    }
    this.setState({
      status: 'error',
      error: {
        kind: 'sdk',
        message: error instanceof Error ? error.message : 'Paddle checkout failed',
        cause: error,
      },
    });
  }

  private async poll(
    runId: number,
    target: CompletionTarget,
    completedAttempts = 0
  ): Promise<void> {
    if (!this.isCurrent(runId)) {
      return;
    }
    this.retryTarget = target;
    try {
      const status = await this.gateway.getStatus();
      if (!this.isCurrent(runId)) {
        return;
      }
      this.gateway.cacheStatus(status);
      if (targetReached(target, status)) {
        this.setState({ status: 'activated', billingStatus: status });
        return;
      }
      const nextAttempts = completedAttempts + 1;
      if (nextAttempts >= this.timing.maxPollAttempts) {
        this.setState({ status: 'timeout', billingStatus: status });
        return;
      }
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.poll(runId, target, nextAttempts);
      }, this.timing.pollIntervalMs);
    } catch (error) {
      this.failRequest(runId, error);
    }
  }

  private async startOverlay(
    target: CompletionTarget,
    paddleConfig: BillingWorkflowPaddleConfig,
    createTransaction: () => Promise<BillingCheckoutResponse>
  ): Promise<void> {
    const runId = this.beginRun();
    try {
      const checkout = await createTransaction();
      if (!this.isCurrent(runId)) {
        return;
      }
      this.setState({ status: 'checkout_open' });
      const result = await this.gateway.openOverlayCheckout({
        token: paddleConfig.token,
        environment: paddleConfig.environment,
        transactionId: checkout.transaction_id,
        handlers: {
          onCompleted: () => {
            if (!this.isCurrent(runId) || this.state.status !== 'checkout_open') {
              return;
            }
            this.setState({ status: 'waiting_activation' });
            void this.poll(runId, target);
          },
          onClosed: () => {
            if (this.isCurrent(runId) && this.state.status === 'checkout_open') {
              this.retryTarget = undefined;
              this.setState(idleState());
            }
          },
          onError: (event) => {
            this.failSdk(runId, new Error(event.detail ?? 'Paddle checkout failed'));
          },
        },
      });
      if (result.ok === false) {
        this.failSdk(runId, result.error);
      }
    } catch (error) {
      this.failRequest(runId, error);
    }
  }

  startPremiumCheckout = (paddleConfig: BillingWorkflowPaddleConfig): Promise<void> =>
    this.startOverlay('premium_checkout', paddleConfig, () => this.gateway.createCheckout());

  startTrialPaymentMethod = (paddleConfig: BillingWorkflowPaddleConfig): Promise<void> =>
    this.startOverlay('trial_payment_method', paddleConfig, () =>
      this.gateway.createPaymentMethodTransaction()
    );

  startPastDueRecovery = (paddleConfig: BillingWorkflowPaddleConfig): Promise<void> =>
    this.startOverlay('past_due_recovery', paddleConfig, () =>
      this.gateway.createPaymentMethodTransaction()
    );

  startCardlessTrial = async (request: BillingTrialStartRequest): Promise<void> => {
    const runId = this.beginRun();
    try {
      await this.gateway.startTrial(request);
      if (!this.isCurrent(runId)) {
        return;
      }
      this.setState({ status: 'waiting_activation' });
      await this.poll(runId, 'cardless_trial');
    } catch (error) {
      this.failRequest(runId, error);
    }
  };

  retry = async (): Promise<void> => {
    if (this.state.status !== 'timeout' || !this.retryTarget) {
      return;
    }
    const target = this.retryTarget;
    this.clearTimer();
    this.runId += 1;
    const runId = this.runId;
    this.setState({ status: 'waiting_activation' });
    await this.poll(runId, target);
  };

  cancel = () => {
    this.clearTimer();
    this.runId += 1;
    this.retryTarget = undefined;
    this.setState(idleState());
  };

  dispose = () => {
    this.clearTimer();
    this.runId += 1;
    this.retryTarget = undefined;
    this.disposed = true;
    this.listeners.clear();
  };
}
