import type { Tracer } from '@opentelemetry/api';

export interface ITelemetryService {
  getTracer(): Tracer | null;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export class TelemetryService implements ITelemetryService {
  private tracer: Tracer | null = null;

  async initialize(): Promise<void> {
    const { initTelemetry } = await import('./telemetry');
    this.tracer = await initTelemetry();
  }

  async shutdown(): Promise<void> {
    const { shutdownTelemetry } = await import('./telemetry');
    await shutdownTelemetry();
    this.tracer = null;
  }

  getTracer(): Tracer | null {
    return this.tracer;
  }
}
