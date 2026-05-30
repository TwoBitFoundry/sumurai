import { expect } from 'bun:test';
import { ApiClient } from '@/services/ApiClient';
import { PasskeyService } from '@/services/passkeyService';
import type { AuthResponse } from '@/types/api';
import { setupTestBoundaries } from '../setup/setupTestBoundaries';

const creationChallenge = {
  publicKey: {
    challenge: 'AQID',
    rp: { id: 'localhost', name: 'Sumurai' },
    user: { id: 'BAUG', name: 'user@example.com', displayName: 'User' },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' as const }],
  },
};

const requestChallenge = {
  publicKey: {
    challenge: 'BAUH',
    rpId: 'localhost',
    allowCredentials: [{ id: 'AQID', type: 'public-key' as const }],
    userVerification: 'preferred' as const,
  },
};

function mockPublicKeyCredential(kind: 'create' | 'get'): PublicKeyCredential {
  if (kind === 'create') {
    return {
      id: 'cred-id',
      rawId: new Uint8Array([1]).buffer,
      type: 'public-key',
      response: {
        attestationObject: new Uint8Array([2]).buffer,
        clientDataJSON: new Uint8Array([3]).buffer,
      },
    } as unknown as PublicKeyCredential;
  }

  return {
    id: 'cred-id',
    rawId: new Uint8Array([1]).buffer,
    type: 'public-key',
    response: {
      authenticatorData: new Uint8Array([4]).buffer,
      clientDataJSON: new Uint8Array([5]).buffer,
      signature: new Uint8Array([6]).buffer,
      userHandle: new Uint8Array([7]).buffer,
    },
  } as unknown as PublicKeyCredential;
}

function installNavigatorCredentials(
  createCredential: PublicKeyCredential,
  getCredential: PublicKeyCredential
): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      credentials: {
        create: jest.fn().mockResolvedValue(createCredential),
        get: jest.fn().mockResolvedValue(getCredential),
      },
    },
  });
  Object.defineProperty(globalThis, 'PublicKeyCredential', {
    configurable: true,
    value: function PublicKeyCredential() {},
  });
}

describe('PasskeyService', () => {
  beforeEach(() => {
    setupTestBoundaries();
    jest.spyOn(ApiClient, 'post');
    jest.spyOn(ApiClient, 'get');
    jest.spyOn(ApiClient, 'delete');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('beginAuthenticatedEnrollment calls the protected enroll begin endpoint', async () => {
    const beginResponse = { session_id: 'session-123', challenge: creationChallenge };
    jest.spyOn(ApiClient, 'post').mockResolvedValueOnce(beginResponse);

    const result = await PasskeyService.beginAuthenticatedEnrollment();

    expect(result).toEqual(beginResponse);
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/passkey/enroll/begin');
  });

  it('finishRegistration posts to the public register finish endpoint', async () => {
    const finishResponse: AuthResponse = {
      user_id: 'user-1',
      expires_at: '2026-01-01T00:00:00Z',
      onboarding_completed: false,
    };
    const credential = mockPublicKeyCredential('create');
    jest.spyOn(ApiClient, 'post').mockResolvedValueOnce(finishResponse);

    const result = await PasskeyService.finishRegistration('session-123', credential, 'Laptop');

    expect(result).toEqual(finishResponse);
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/passkey/register/finish', {
      session_id: 'session-123',
      response: expect.any(Object),
      name: 'Laptop',
    });
  });

  it('enrollPasskey runs protected enroll begin and finish', async () => {
    const beginResponse = { session_id: 'session-123', challenge: creationChallenge };
    const finishResponse = { id: 'passkey-1', name: 'Laptop', created_at: '2026-01-01T00:00:00Z' };
    const credential = mockPublicKeyCredential('create');
    installNavigatorCredentials(credential, credential);
    jest
      .spyOn(ApiClient, 'post')
      .mockResolvedValueOnce(beginResponse)
      .mockResolvedValueOnce(finishResponse);

    const result = await PasskeyService.enrollPasskey('Laptop');

    expect(result).toEqual(finishResponse);
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/passkey/enroll/begin');
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/passkey/enroll/finish', {
      session_id: 'session-123',
      response: expect.any(Object),
      name: 'Laptop',
    });
  });

  it('beginLogin posts email to login begin endpoint', async () => {
    const beginResponse = {
      session_id: 'login-session',
      challenge: requestChallenge,
      account_exists: true,
      passkey_available: true,
      password_available: false,
    };
    jest.spyOn(ApiClient, 'post').mockResolvedValueOnce(beginResponse);

    const result = await PasskeyService.beginLogin('user@example.com');

    expect(result).toEqual(beginResponse);
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/passkey/login/begin', {
      email: 'user@example.com',
    });
  });

  it('finishLogin posts serialized assertion to login finish endpoint', async () => {
    const authResponse: AuthResponse = {
      user_id: 'user-1',
      expires_at: '2026-01-01T00:00:00Z',
      onboarding_completed: false,
    };
    const credential = mockPublicKeyCredential('get');
    jest.spyOn(ApiClient, 'post').mockResolvedValueOnce(authResponse);

    const result = await PasskeyService.finishLogin('login-session', credential);

    expect(result).toEqual(authResponse);
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/passkey/login/finish', {
      session_id: 'login-session',
      response: expect.any(Object),
    });
  });

  it('signIn runs login begin, browser get, and login finish', async () => {
    const beginResponse = {
      session_id: 'login-session',
      challenge: requestChallenge,
      account_exists: true,
      passkey_available: true,
      password_available: false,
    };
    const authResponse: AuthResponse = {
      user_id: 'user-1',
      expires_at: '2026-01-01T00:00:00Z',
      onboarding_completed: true,
    };
    const credential = mockPublicKeyCredential('get');
    installNavigatorCredentials(credential, credential);
    jest
      .spyOn(ApiClient, 'post')
      .mockResolvedValueOnce(beginResponse)
      .mockResolvedValueOnce(authResponse);

    const result = await PasskeyService.signIn('user@example.com');

    expect(result).toEqual(authResponse);
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/passkey/login/begin', {
      email: 'user@example.com',
    });
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/passkey/login/finish', {
      session_id: 'login-session',
      response: expect.any(Object),
    });
  });

  it('beginSignUp posts email and name to register endpoint', async () => {
    const beginResponse = {
      user_id: 'user-2',
      session_id: 'signup-session',
      challenge: creationChallenge,
    };
    jest.spyOn(ApiClient, 'post').mockResolvedValueOnce(beginResponse);

    const result = await PasskeyService.beginSignUp('new@example.com', 'New User');

    expect(result).toEqual(beginResponse);
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/register', {
      email: 'new@example.com',
      name: 'New User',
    });
  });

  it('signUp runs register, browser create, and register finish', async () => {
    const beginResponse = {
      user_id: 'user-2',
      session_id: 'signup-session',
      challenge: creationChallenge,
    };
    const authResponse: AuthResponse = {
      user_id: 'user-2',
      expires_at: '2026-01-01T00:00:00Z',
      onboarding_completed: false,
    };
    const credential = mockPublicKeyCredential('create');
    installNavigatorCredentials(credential, credential);
    jest
      .spyOn(ApiClient, 'post')
      .mockResolvedValueOnce(beginResponse)
      .mockResolvedValueOnce(authResponse);

    const result = await PasskeyService.signUp('new@example.com', 'New User', 'Device');

    expect(result).toEqual(authResponse);
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/register', {
      email: 'new@example.com',
      name: 'New User',
    });
    expect(ApiClient.post).toHaveBeenCalledWith('/auth/passkey/register/finish', {
      session_id: 'signup-session',
      response: expect.any(Object),
      name: 'Device',
    });
  });

  it('list fetches enrolled passkeys', async () => {
    const passkeys = [{ id: 'pk-1', name: 'Laptop', created_at: '2026-01-01T00:00:00Z' }];
    jest.spyOn(ApiClient, 'get').mockResolvedValueOnce(passkeys);

    const result = await PasskeyService.list();

    expect(result).toEqual(passkeys);
    expect(ApiClient.get).toHaveBeenCalledWith('/auth/passkey');
  });

  it('remove deletes passkey by id', async () => {
    jest.spyOn(ApiClient, 'delete').mockResolvedValueOnce(undefined);

    await PasskeyService.remove('pk-1');

    expect(ApiClient.delete).toHaveBeenCalledWith('/auth/passkey/pk-1');
  });
});
