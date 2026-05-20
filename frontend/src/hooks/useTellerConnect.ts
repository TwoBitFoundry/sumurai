/**
 * Utilities for loading the Teller Connect browser SDK.
 */

export type {
  TellerConnectGateway,
  TellerEnvironment,
} from '@/features/teller/tellerConnectScript';
export { apiGateway, resetTellerScriptStateForTests } from '@/features/teller/tellerConnectScript';
