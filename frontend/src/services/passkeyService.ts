import type {
  AuthResponse,
  PasskeyItem,
  PasskeyLoginBeginResponse,
  PasskeyRegisterBeginResponse,
  RegisterBeginResponse,
} from '@/types/api';
import {
  type CreationChallengeResponseJSON,
  createPasskeyCredential,
  getPasskeyCredential,
  type RequestChallengeResponseJSON,
  serializeAuthenticationCredential,
  serializeRegistrationCredential,
} from '../utils/webauthnEncoding';
import { ApiClient } from './ApiClient';

export function suggestPasskeyName(): string {
  if (typeof navigator === 'undefined') {
    return 'Passkey';
  }
  const platform = navigator.platform?.trim();
  if (platform) {
    return platform;
  }
  return 'Passkey';
}

function parseCreationChallenge(challenge: Record<string, unknown>): CreationChallengeResponseJSON {
  return challenge as CreationChallengeResponseJSON;
}

function parseRequestChallenge(challenge: Record<string, unknown>): RequestChallengeResponseJSON {
  return challenge as RequestChallengeResponseJSON;
}

export class PasskeyService {
  static async beginRegistration(): Promise<PasskeyRegisterBeginResponse> {
    return ApiClient.post<PasskeyRegisterBeginResponse>('/auth/passkey/register/begin');
  }

  static async finishRegistration(
    sessionId: string,
    credential: PublicKeyCredential,
    name?: string
  ): Promise<PasskeyItem | AuthResponse> {
    return ApiClient.post<PasskeyItem | AuthResponse>('/auth/passkey/register/finish', {
      session_id: sessionId,
      response: serializeRegistrationCredential(credential),
      name: name?.trim() || suggestPasskeyName(),
    });
  }

  static async enrollPasskey(name?: string): Promise<PasskeyItem | AuthResponse> {
    const begin = await PasskeyService.beginRegistration();
    const credential = await createPasskeyCredential(parseCreationChallenge(begin.challenge));
    return PasskeyService.finishRegistration(begin.session_id, credential, name);
  }

  static async beginLogin(email: string): Promise<PasskeyLoginBeginResponse> {
    return ApiClient.post<PasskeyLoginBeginResponse>('/auth/passkey/login/begin', { email });
  }

  static async finishLogin(
    sessionId: string,
    credential: PublicKeyCredential
  ): Promise<AuthResponse> {
    return ApiClient.post<AuthResponse>('/auth/passkey/login/finish', {
      session_id: sessionId,
      response: serializeAuthenticationCredential(credential),
    });
  }

  static async signIn(email: string): Promise<AuthResponse> {
    const begin = await PasskeyService.beginLogin(email);
    const credential = await getPasskeyCredential(parseRequestChallenge(begin.challenge));
    return PasskeyService.finishLogin(begin.session_id, credential);
  }

  static async beginSignUp(email: string, name: string): Promise<RegisterBeginResponse> {
    return ApiClient.post<RegisterBeginResponse>('/auth/register', { email, name });
  }

  static async signUp(email: string, name: string, passkeyName?: string): Promise<AuthResponse> {
    const begin = await PasskeyService.beginSignUp(email, name);
    const credential = await createPasskeyCredential(parseCreationChallenge(begin.challenge));
    const result = await PasskeyService.finishRegistration(
      begin.session_id,
      credential,
      passkeyName
    );
    if (!('user_id' in result)) {
      throw new Error('Passkey signup did not return an authenticated session');
    }
    return result;
  }

  static async list(): Promise<PasskeyItem[]> {
    return ApiClient.get<PasskeyItem[]>('/auth/passkey');
  }

  static async remove(id: string): Promise<void> {
    await ApiClient.delete(`/auth/passkey/${id}`);
  }
}
