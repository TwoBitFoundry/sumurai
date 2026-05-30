import type { PasskeyItem } from '@/types/api';
import {
  emptyResponse,
  jsonResponse,
  pushStoryCredentialsOverride,
  route,
  type StoryApiRequest,
  type StoryApiRoute,
} from './storyApi';

const enrollChallenge = {
  publicKey: {
    challenge: 'AQID',
    rp: { id: 'localhost', name: 'Sumurai' },
    user: { id: 'BAUG', name: 'user@example.com', displayName: 'User' },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' as const }],
  },
};

export const storyPasskeysMacBook: PasskeyItem = {
  id: 'pk-story-1',
  name: 'MacBook Pro',
  created_at: '2026-01-10T00:00:00Z',
  last_used_at: '2026-03-15T08:00:00Z',
};

export const storyPasskeysIPhone: PasskeyItem = {
  id: 'pk-story-2',
  name: 'iPhone',
  created_at: '2026-02-01T00:00:00Z',
  last_used_at: '2026-03-14T18:30:00Z',
};

function passkeyDeleteRoute(passkeys: PasskeyItem[]): StoryApiRoute {
  return {
    match: (request) => request.method === 'DELETE' && request.path.startsWith('/auth/passkey/'),
    respond: (request) => {
      const id = request.path.slice('/auth/passkey/'.length);
      const index = passkeys.findIndex((entry) => entry.id === id);
      if (index === -1) {
        return jsonResponse({ message: 'Passkey not found' }, { status: 404 });
      }
      if (passkeys.length <= 1) {
        return jsonResponse(
          { message: 'Cannot remove the last enrolled passkey' },
          { status: 409 }
        );
      }
      passkeys.splice(index, 1);
      return emptyResponse(204);
    },
  };
}

export function buildPasskeyHandlers(initial: PasskeyItem[]): StoryApiRoute[] {
  const passkeys = initial.map((entry) => ({ ...entry }));

  return [
    route('GET', '/auth/passkey', () => jsonResponse([...passkeys])),
    route('POST', '/auth/passkey/enroll/begin', () =>
      jsonResponse({ session_id: 'story-enroll-session', challenge: enrollChallenge })
    ),
    route('POST', '/auth/passkey/enroll/finish', (request: StoryApiRequest) => {
      const body = request.body as { name?: string } | undefined;
      const item: PasskeyItem = {
        id: `pk-story-${passkeys.length + 1}`,
        name: body?.name?.trim() || 'Passkey',
        created_at: new Date().toISOString(),
        last_used_at: null,
      };
      passkeys.push(item);
      return jsonResponse(item);
    }),
    passkeyDeleteRoute(passkeys),
  ];
}

export function buildPasskeyListFailureHandlers(): StoryApiRoute[] {
  return [
    route('GET', '/auth/passkey', () =>
      jsonResponse({ message: 'Failed to retrieve passkeys' }, { status: 500 })
    ),
  ];
}

export function buildPasskeyEnrollFailureHandlers(initial: PasskeyItem[]): StoryApiRoute[] {
  const passkeys = initial.map((entry) => ({ ...entry }));

  return [
    route('GET', '/auth/passkey', () => jsonResponse([...passkeys])),
    route('POST', '/auth/passkey/enroll/begin', () =>
      jsonResponse({ session_id: 'story-enroll-session', challenge: enrollChallenge })
    ),
    route('POST', '/auth/passkey/enroll/finish', () =>
      jsonResponse({ message: 'Passkey verification failed' }, { status: 400 })
    ),
    passkeyDeleteRoute(passkeys),
  ];
}

const storyCreateCredential = {
  id: 'story-cred-id',
  rawId: new Uint8Array([1]).buffer,
  type: 'public-key',
  response: {
    attestationObject: new Uint8Array([2]).buffer,
    clientDataJSON: new Uint8Array([3]).buffer,
  },
} as unknown as PublicKeyCredential;

const storyGetCredential = {
  id: 'story-cred-id',
  rawId: new Uint8Array([1]).buffer,
  type: 'public-key',
  response: {
    authenticatorData: new Uint8Array([4]).buffer,
    clientDataJSON: new Uint8Array([5]).buffer,
    signature: new Uint8Array([6]).buffer,
    userHandle: new Uint8Array([7]).buffer,
  },
} as unknown as PublicKeyCredential;

export function installStoryWebAuthnBoundary(): () => void {
  return pushStoryCredentialsOverride({
    create: async () => storyCreateCredential,
    get: async () => storyGetCredential,
  });
}

export async function withStoryWebAuthn(run: () => Promise<void>): Promise<void> {
  const restore = installStoryWebAuthnBoundary();
  try {
    await run();
  } finally {
    restore();
  }
}
