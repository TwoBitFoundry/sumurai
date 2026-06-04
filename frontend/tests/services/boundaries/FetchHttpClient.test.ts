import {
  AuthenticationError,
  FetchHttpClient,
  ForbiddenError,
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
});
