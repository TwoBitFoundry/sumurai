import type {
  CreateDiyAccountRequest,
  CreateDiyAccountResponse,
  CreateDiyInstitutionRequest,
  CreateDiyInstitutionResponse,
  DisconnectResponse,
} from '@/types/api';
import { ApiClient } from './ApiClient';

export class DiyService {
  static async createInstitution(name: string): Promise<CreateDiyInstitutionResponse> {
    const request: CreateDiyInstitutionRequest = { name };
    return ApiClient.post<CreateDiyInstitutionResponse>('/diy/institutions', request);
  }

  static async createAccount(
    connectionId: string,
    request: CreateDiyAccountRequest
  ): Promise<CreateDiyAccountResponse> {
    return ApiClient.post<CreateDiyAccountResponse>(
      `/diy/institutions/${connectionId}/accounts`,
      request
    );
  }

  static async disconnectInstitution(connectionId: string): Promise<DisconnectResponse> {
    return ApiClient.delete<DisconnectResponse>(`/diy/institutions/${connectionId}`);
  }
}
