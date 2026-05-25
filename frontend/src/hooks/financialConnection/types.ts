/**
 * Shared types for provider connection strategies.
 */

import type { Dispatch, MutableRefObject, ReactElement, SetStateAction } from 'react';
import type {
  FinancialConnectionAction,
  FinancialConnectionState,
} from '@/hooks/financialConnection/connectionState';
import type { TellerEnvironment } from '@/hooks/useTellerConnect';
import type { SimpleFinInstitutionAuthRequired } from '@/types/api';

export interface FinancialConnectionStrategy {
  getReady: () => boolean;
  open: () => void;
  load: () => Promise<void>;
  reset: () => void;
  loadFailedMessage: string;
  render: () => ReactElement | null;
  connect?: (setupToken?: string) => Promise<void>;
}

export interface FinancialConnectionStrategyContext {
  isOnline: boolean;
  sdkNonce: number;
  setSdkNonce: Dispatch<SetStateAction<number>>;
  setReady: Dispatch<SetStateAction<boolean>>;
  sdkFailedRef: MutableRefObject<boolean>;
  state: FinancialConnectionState;
  dispatch: Dispatch<FinancialConnectionAction>;
  handleError: (message: string) => void;
  onConnectionSuccess?: (institutionName: string) => void;
  onSimpleFinAuthRequired?: (institutions: SimpleFinInstitutionAuthRequired[]) => void;
  invalidateCache: () => Promise<void>;
  tellerApplicationId: string | null;
  tellerEnvironment: TellerEnvironment;
}

export const PENDING_CONNECTION_STRATEGY: FinancialConnectionStrategy = {
  getReady: () => false,
  open: () => {},
  load: async () => {},
  reset: () => {},
  loadFailedMessage: '',
  render: () => null,
};
