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

export function installStoryProviderConnectWindows(): void {
  installStoryPlaidConnectWindow();
}
