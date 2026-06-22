import { resetPlaidScriptStateForTests } from '@/features/plaid/plaidLinkScript';

export function installStoryPlaidConnectWindow(): void {
  if (typeof window === 'undefined') {
    return;
  }

  resetPlaidScriptStateForTests();

  window.Plaid = {
    create: () => ({
      open: () => {},
      submit: () => {},
      destroy: () => {},
      exit: () => {},
    }),
  } as unknown as Window['Plaid'];
}

export function installStoryTellerConnectWindow(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.TellerConnect = {
    setup: () => ({
      open: () => {},
      destroy: () => {},
    }),
  };
}

export function installStoryProviderConnectWindows(): void {
  installStoryPlaidConnectWindow();
  installStoryTellerConnectWindow();
}
