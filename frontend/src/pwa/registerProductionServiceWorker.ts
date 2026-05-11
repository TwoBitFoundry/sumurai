export type RegisterProductionServiceWorkerDeps = {
  register: (
    scriptURL: string | URL,
    options?: RegistrationOptions
  ) => Promise<ServiceWorkerRegistration>;
  isProduction: boolean;
  hasServiceWorker: boolean;
};

export async function registerProductionServiceWorker(
  deps: RegisterProductionServiceWorkerDeps
): Promise<ServiceWorkerRegistration | undefined> {
  if (!deps.isProduction || !deps.hasServiceWorker) {
    return undefined;
  }
  try {
    return await deps.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  } catch {
    return undefined;
  }
}
