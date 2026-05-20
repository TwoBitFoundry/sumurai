import { SpanStatusCode } from '@opentelemetry/api';
import { recordHandledIssue } from '@/observability/recordHandledIssue';

const end = jest.fn();
const setStatus = jest.fn();
const recordException = jest.fn();
const addEvent = jest.fn();
const startSpan = jest.fn(() => ({
  end,
  setStatus,
  recordException,
  addEvent,
}));

jest.mock('@opentelemetry/api', () => {
  const actual = jest.requireActual('@opentelemetry/api');
  return {
    ...actual,
    trace: {
      getTracer: () => ({
        startSpan,
      }),
    },
  };
});

describe('recordHandledIssue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('given handled failure when recorded then marks span as error with handled attribute', () => {
    const cause = new Error('sync failed');

    recordHandledIssue('financial-connection.plaid.sync', 'Sync failed', cause, {
      provider: 'plaid',
    });

    expect(startSpan).toHaveBeenCalledWith('financial-connection.plaid.sync', {
      attributes: {
        provider: 'plaid',
        'issue.handled': true,
        'issue.message': 'Sync failed',
      },
    });
    expect(recordException).toHaveBeenCalledWith(cause);
    expect(addEvent).toHaveBeenCalledWith('Sync failed');
    expect(setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: 'Sync failed',
    });
    expect(end).toHaveBeenCalled();
  });

  it('given handled issue without cause when recorded then still ends span as error', () => {
    recordHandledIssue('financial-connection.plaid.script-load', 'Script failed');

    expect(recordException).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: 'Script failed',
    });
    expect(end).toHaveBeenCalled();
  });
});
