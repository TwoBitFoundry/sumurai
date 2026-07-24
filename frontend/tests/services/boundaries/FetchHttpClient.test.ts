import {
  AuthenticationError,
  ConflictError,
  FetchHttpClient,
  ForbiddenError,
  PaymentRequiredError,
  ServerError,
  ValidationError,
} from '@/services/boundaries';

describe('FetchHttpClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends multipart requests without setting content-type and includes credentials', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const client = new FetchHttpClient('http://example.com/api');
    const formData = new FormData();
    formData.append('file', new Blob(['abc'], { type: 'text/plain' }), 'test.txt');

    await client.postFormData('/transactions/import', formData);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://example.com/api/transactions/import',
      expect.objectContaining({
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: undefined,
      })
    );
  });

  it('returns blobs and parses filenames for download responses', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(new Blob(['hello'], { type: 'text/csv' }), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="sumurai-export-20240601.csv"',
        },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const client = new FetchHttpClient('http://example.com/api');
    const result = await client.getBlob('/export?format=csv');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://example.com/api/export?format=csv',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      })
    );
    expect(result.filename).toBe('sumurai-export-20240601.csv');
    expect(result.blob.type).toBe('text/csv');
  });

  it('maps multipart validation errors to api error subclasses', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid file' }), {
        status: 400,
        statusText: 'Bad Request',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    globalThis.fetch = fetchMock as typeof fetch;

    const client = new FetchHttpClient('http://example.com/api');

    await expect(
      client.postFormData('/transactions/import/validate', new FormData())
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('maps auth and server errors for multipart requests', async () => {
    const responses = [
      new Response(
        JSON.stringify({
          error: 'FORBIDDEN',
          message: 'Passkey enrollment is required before continuing',
          code: 'passkey_enrollment_required',
        }),
        {
          status: 403,
          statusText: 'Forbidden',
          headers: { 'Content-Type': 'application/json' },
        }
      ),
      new Response(JSON.stringify({ detail: 'Down' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }),
      new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'Content-Type': 'application/json' },
      }),
    ];
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(responses[0])
      .mockResolvedValueOnce(responses[1])
      .mockResolvedValueOnce(responses[2]);
    globalThis.fetch = fetchMock as typeof fetch;

    const client = new FetchHttpClient('http://example.com/api');

    await expect(client.postFormData('/test', new FormData())).rejects.toMatchObject({
      code: 'passkey_enrollment_required',
    });
    await expect(client.postFormData('/test', new FormData())).rejects.toBeInstanceOf(ServerError);
    await expect(client.postFormData('/test', new FormData())).rejects.toBeInstanceOf(
      AuthenticationError
    );
  });

  it('preserves the backend code and body for payment-required responses', async () => {
    const body = {
      error: 'PAYMENT_REQUIRED',
      message: 'Paid access is required',
      code: 'PAID_ACCESS_REQUIRED',
    };
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as typeof fetch;

    const client = new FetchHttpClient('http://example.com/api');
    let caught: unknown;

    try {
      await client.post('/providers/select', { provider: 'plaid' });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PaymentRequiredError);
    const paymentError = caught as PaymentRequiredError;
    expect(paymentError.name).toBe('PaymentRequiredError');
    expect(paymentError.status).toBe(402);
    expect(paymentError.code).toBe('PAID_ACCESS_REQUIRED');
    expect(paymentError.body).toEqual(body);
  });

  it('preserves the backend code and body for conflict responses', async () => {
    const body = {
      error: 'CONFLICT',
      message: 'Trial already used',
      code: 'TRIAL_ALREADY_USED',
    };
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as typeof fetch;

    const client = new FetchHttpClient('http://example.com/api');
    let caught: unknown;

    try {
      await client.post('/billing/trials/start', {});
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConflictError);
    const conflictError = caught as ConflictError;
    expect(conflictError.name).toBe('ConflictError');
    expect(conflictError.status).toBe(409);
    expect(conflictError.code).toBe('TRIAL_ALREADY_USED');
    expect(conflictError.body).toEqual(body);
  });
});
