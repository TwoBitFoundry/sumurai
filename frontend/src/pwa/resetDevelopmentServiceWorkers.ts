const DEV_SW_RESET_KEY = 'sumurai-dev-sw-reset';

export type ResetDevelopmentServiceWorkersDeps = {
  getRegistrations: () => Promise<readonly ServiceWorkerRegistration[]>;
  hasController: boolean;
  reload: () => void;
  getReloadMarker: () => string | null;
  setReloadMarker: (value: string) => void;
  clearReloadMarker: () => void;
};

export async function resetDevelopmentServiceWorkers(
  deps: ResetDevelopmentServiceWorkersDeps
): Promise<void> {
  const registrations = await deps.getRegistrations();
  if (registrations.length === 0) {
    deps.clearReloadMarker();
    return;
  }

  const results = await Promise.all(registrations.map((registration) => registration.unregister()));
  const removedAny = results.some(Boolean);

  if (!removedAny) {
    deps.clearReloadMarker();
    return;
  }

  if (deps.hasController) {
    const marker = deps.getReloadMarker();
    if (marker !== DEV_SW_RESET_KEY) {
      deps.setReloadMarker(DEV_SW_RESET_KEY);
      deps.reload();
    }
    return;
  }

  deps.clearReloadMarker();
}
