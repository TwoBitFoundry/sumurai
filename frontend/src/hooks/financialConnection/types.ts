import type { Dispatch, MutableRefObject, ReactElement, SetStateAction } from 'react';

export interface FinancialConnectionStrategy {
  getReady: () => boolean;
  open: () => void;
  load: () => Promise<void>;
  reset: () => void;
  loadFailedMessage: string;
  render: () => ReactElement | null;
}

export interface FinancialConnectionStrategyContext {
  isOnline: boolean;
  sdkNonce: number;
  setSdkNonce: Dispatch<SetStateAction<number>>;
  sdkFailedRef: MutableRefObject<boolean>;
  handleError: (message: string) => void;
  setConnectionInProgress: Dispatch<SetStateAction<boolean>>;
  setIsConnected: Dispatch<SetStateAction<boolean>>;
  setInstitutionName: Dispatch<SetStateAction<string | null>>;
  setIsSyncing: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  onConnectionSuccess?: (institutionName: string) => void;
  invalidateCache: () => Promise<void>;
}

export const PENDING_CONNECTION_STRATEGY: FinancialConnectionStrategy = {
  getReady: () => false,
  open: () => {},
  load: async () => {},
  reset: () => {},
  loadFailedMessage: '',
  render: () => null,
};
