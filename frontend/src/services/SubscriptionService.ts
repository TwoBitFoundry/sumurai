import type { SubscriptionSummary } from '../types/api';
import { ApiClient } from './ApiClient';

export class SubscriptionService {
  static async getSubscriptions(): Promise<SubscriptionSummary[]> {
    return ApiClient.get<SubscriptionSummary[]>('/subscriptions');
  }
}
