import type { AutoCategorizationJobState } from '../types/api';
import { ApiClient, ConflictError } from './ApiClient';

function parseJobState(value: unknown): AutoCategorizationJobState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as AutoCategorizationJobState;
  if (typeof candidate.job_id !== 'string' || typeof candidate.status !== 'string') {
    return null;
  }

  return candidate;
}

export class AutoCategorizationService {
  static async getStatus(): Promise<AutoCategorizationJobState | null> {
    return ApiClient.get<AutoCategorizationJobState | null>('/transactions/auto-categorize');
  }

  static async start(): Promise<AutoCategorizationJobState> {
    try {
      return await ApiClient.post<AutoCategorizationJobState>('/transactions/auto-categorize');
    } catch (error) {
      if (error instanceof ConflictError) {
        const activeJob = parseJobState(error.body);
        if (activeJob) {
          return activeJob;
        }
      }
      throw error;
    }
  }

  static async cancel(): Promise<AutoCategorizationJobState> {
    return ApiClient.delete<AutoCategorizationJobState>('/transactions/auto-categorize');
  }
}
