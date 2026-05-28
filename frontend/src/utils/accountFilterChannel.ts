export const ACCOUNT_FILTER_CHANNEL = 'sumurai.account-filter';

export type AccountFilterMessage =
  | { type: 'filter-changed'; selectedIds: string[] }
  | { type: 'filter-request' }
  | { type: 'filter-response'; selectedIds: string[] };

export function canUseBroadcastChannel(): boolean {
  return typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined';
}
