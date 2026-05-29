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

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function toBufferSource(value: string): BufferSource {
  const bytes = base64UrlToBytes(value);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

type PublicKeyCredentialDescriptorJSON = {
  id: string;
  type: PublicKeyCredentialType;
  transports?: AuthenticatorTransport[];
};

type PublicKeyCredentialCreationOptionsJSON = {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  excludeCredentials?: PublicKeyCredentialDescriptorJSON[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
};

export type CreationChallengeResponseJSON = {
  publicKey: PublicKeyCredentialCreationOptionsJSON;
};

export function toCredentialCreationOptions(
  challenge: CreationChallengeResponseJSON
): CredentialCreationOptions {
  const publicKey = challenge.publicKey;
  return {
    publicKey: {
      ...publicKey,
      challenge: toBufferSource(publicKey.challenge),
      user: {
        ...publicKey.user,
        id: toBufferSource(publicKey.user.id),
      },
      excludeCredentials: publicKey.excludeCredentials?.map((credential) => ({
        ...credential,
        id: toBufferSource(credential.id),
      })),
    },
  };
}

export function serializeRegistrationCredential(
  credential: PublicKeyCredential
): Record<string, unknown> {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bytesToBase64Url(new Uint8Array(credential.rawId)),
    type: credential.type,
    response: {
      attestationObject: bytesToBase64Url(new Uint8Array(response.attestationObject)),
      clientDataJSON: bytesToBase64Url(new Uint8Array(response.clientDataJSON)),
    },
  };
}

export async function createPasskeyCredential(
  challenge: CreationChallengeResponseJSON
): Promise<PublicKeyCredential> {
  const options = toCredentialCreationOptions(challenge);
  const credential = await navigator.credentials.create(options);
  if (!credential || credential.type !== 'public-key') {
    throw new Error('Passkey creation was cancelled or failed');
  }
  return credential as PublicKeyCredential;
}

type PublicKeyCredentialRequestOptionsJSON = {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: PublicKeyCredentialDescriptorJSON[];
  userVerification?: UserVerificationRequirement;
};

export type RequestChallengeResponseJSON = {
  publicKey: PublicKeyCredentialRequestOptionsJSON;
};

export function toCredentialRequestOptions(
  challenge: RequestChallengeResponseJSON
): CredentialRequestOptions {
  const publicKey = challenge.publicKey;
  return {
    publicKey: {
      ...publicKey,
      challenge: toBufferSource(publicKey.challenge),
      allowCredentials: publicKey.allowCredentials?.map((credential) => ({
        ...credential,
        id: toBufferSource(credential.id),
      })),
    },
  };
}

export function serializeAuthenticationCredential(
  credential: PublicKeyCredential
): Record<string, unknown> {
  const response = credential.response as AuthenticatorAssertionResponse;
  const payload: Record<string, unknown> = {
    id: credential.id,
    rawId: bytesToBase64Url(new Uint8Array(credential.rawId)),
    type: credential.type,
    response: {
      authenticatorData: bytesToBase64Url(new Uint8Array(response.authenticatorData)),
      clientDataJSON: bytesToBase64Url(new Uint8Array(response.clientDataJSON)),
      signature: bytesToBase64Url(new Uint8Array(response.signature)),
    },
  };

  if (response.userHandle && response.userHandle.byteLength > 0) {
    (payload.response as Record<string, unknown>).userHandle = bytesToBase64Url(
      new Uint8Array(response.userHandle)
    );
  }

  return payload;
}

export async function getPasskeyCredential(
  challenge: RequestChallengeResponseJSON
): Promise<PublicKeyCredential> {
  const options = toCredentialRequestOptions(challenge);
  const credential = await navigator.credentials.get(options);
  if (!credential || credential.type !== 'public-key') {
    throw new Error('Passkey sign-in was cancelled or failed');
  }
  return credential as PublicKeyCredential;
}
