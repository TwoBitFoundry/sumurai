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
