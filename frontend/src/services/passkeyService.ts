import {
  type CreationChallengeResponseJSON,
  createPasskeyCredential,
  serializeRegistrationCredential,
} from '../utils/webauthnEncoding';
import { ApiClient } from './ApiClient';
import type { AuthResponse } from './authService';

export interface PasskeyRegisterBeginResponse {
  session_id: string;
  challenge: CreationChallengeResponseJSON;
}

export interface PasskeyItem {
  id: string;
  name: string;
  created_at: string;
  last_used_at?: string | null;
}

function defaultPasskeyName(): string {
  if (typeof navigator === 'undefined') {
    return 'Passkey';
  }
  const platform = navigator.platform?.trim();
  if (platform) {
    return platform;
  }
  return 'Passkey';
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
      name: name?.trim() || defaultPasskeyName(),
    });
  }

  static async enrollPasskey(name?: string): Promise<PasskeyItem | AuthResponse> {
    const begin = await PasskeyService.beginRegistration();
    const credential = await createPasskeyCredential(begin.challenge);
    return PasskeyService.finishRegistration(begin.session_id, credential, name);
  }
}
