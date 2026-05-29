import { expect } from 'bun:test';
import {
  bytesToBase64Url,
  serializeRegistrationCredential,
  toCredentialCreationOptions,
} from '@/utils/webauthnEncoding';

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

describe('webauthnEncoding', () => {
  it('round-trips base64url buffers used by WebAuthn challenges', () => {
    const original = new Uint8Array([1, 2, 3, 4, 255]);
    const encoded = bytesToBase64Url(original);
    const decoded = base64UrlToBytes(encoded);

    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('converts server creation options into ArrayBuffer-backed credential options', () => {
    const challenge = {
      publicKey: {
        challenge: 'AQID',
        rp: { id: 'localhost', name: 'Sumurai' },
        user: {
          id: 'BAUG',
          name: 'user@example.com',
          displayName: 'User',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' as const }],
      },
    };

    const options = toCredentialCreationOptions(challenge);
    expect(options.publicKey?.challenge).toBeInstanceOf(ArrayBuffer);
    expect(options.publicKey?.user.id).toBeInstanceOf(ArrayBuffer);
  });

  it('serializes registration credentials to base64url JSON fields', () => {
    const credential = {
      id: 'cred-id',
      rawId: new Uint8Array([9, 8, 7]).buffer,
      type: 'public-key',
      response: {
        attestationObject: new Uint8Array([1, 2]).buffer,
        clientDataJSON: new Uint8Array([3, 4]).buffer,
      },
    } as unknown as PublicKeyCredential;

    const serialized = serializeRegistrationCredential(credential);
    expect(serialized.id).toBe('cred-id');
    expect(typeof serialized.rawId).toBe('string');
    expect(typeof (serialized.response as { attestationObject: string }).attestationObject).toBe(
      'string'
    );
  });
});
