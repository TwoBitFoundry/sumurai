import { expect } from 'bun:test';
import { ApiClient } from '@/services/ApiClient';
import { PasskeyService } from '@/services/passkeyService';
import { setupTestBoundaries } from '../setup/setupTestBoundaries';

describe('PasskeyService', () => {
  beforeEach(() => {
    setupTestBoundaries();
    jest.spyOn(ApiClient, 'post');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls begin and finish registration endpoints through ApiClient', async () => {
    const beginResponse = {
      session_id: 'session-123',
      challenge: {
        publicKey: {
          challenge: 'AQID',
          rp: { id: 'localhost', name: 'Sumurai' },
          user: { id: 'BAUG', name: 'user@example.com', displayName: 'User' },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' as const }],
        },
      },
    };
    const finishResponse = { id: 'passkey-1', name: 'Laptop', created_at: '2026-01-01T00:00:00Z' };
    const credential = {
      id: 'cred-id',
      rawId: new Uint8Array([1]).buffer,
      type: 'public-key',
      response: {
        attestationObject: new Uint8Array([2]).buffer,
        clientDataJSON: new Uint8Array([3]).buffer,
      },
    } as unknown as PublicKeyCredential;

    jest
      .spyOn(ApiClient, 'post')
      .mockResolvedValueOnce(beginResponse)
      .mockResolvedValueOnce(finishResponse);
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        credentials: {
          create: jest.fn().mockResolvedValue(credential),
        },
      },
    });
    Object.defineProperty(globalThis, 'PublicKeyCredential', {
      configurable: true,
      value: function PublicKeyCredential() {},
    });

    const result = await PasskeyService.enrollPasskey('Laptop');

    expect(result).toEqual(finishResponse);
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/passkey/register/begin');
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/passkey/register/finish', {
      session_id: 'session-123',
      response: expect.any(Object),
      name: 'Laptop',
    });
  });
});
