export type RegisterProductionServiceWorkerDeps = {
  register: (
    scriptURL: string | URL,
    options?: RegistrationOptions
  ) => Promise<ServiceWorkerRegistration>;
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  hasServiceWorker: boolean;
};

export async function registerProductionServiceWorker(
  deps: RegisterProductionServiceWorkerDeps
): Promise<ServiceWorkerRegistration | undefined> {
  if (!deps.hasServiceWorker) {
    return undefined;
  }
  try {
    const swProbe = await deps.fetch('/sw.js', {
      method: 'HEAD',
      cache: 'no-store',
    });
    if (!swProbe.ok) {
      return undefined;
    }
    return await deps.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  } catch {
    return undefined;
  }
}
