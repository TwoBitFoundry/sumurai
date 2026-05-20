/**
 * Shared connection state and reducer actions for link flows.
 */

export interface FinancialConnectionState {
  isConnected: boolean;
  connectionInProgress: boolean;
  isSyncing: boolean;
  institutionName: string | null;
  error: string | null;
}

export type FinancialConnectionAction =
  | { type: 'patch'; patch: Partial<FinancialConnectionState> }
  | { type: 'reset' };

export const initialFinancialConnectionState: FinancialConnectionState = {
  isConnected: false,
  connectionInProgress: false,
  isSyncing: false,
  institutionName: null,
  error: null,
};

export function financialConnectionReducer(
  state: FinancialConnectionState,
  action: FinancialConnectionAction
): FinancialConnectionState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'reset':
      return initialFinancialConnectionState;
  }
}

export const connectionActions = {
  patch: (patch: Partial<FinancialConnectionState>): FinancialConnectionAction => ({
    type: 'patch',
    patch,
  }),
  reset: (): FinancialConnectionAction => ({ type: 'reset' }),
};
