import { registerProductionServiceWorker } from '@/pwa/registerProductionServiceWorker';

describe('registerProductionServiceWorker', () => {
  it('skips when not production', async () => {
    const register = jest.fn();
    await registerProductionServiceWorker({
      register,
      isProduction: false,
      hasServiceWorker: true,
    });
    expect(register).not.toHaveBeenCalled();
  });

  it('skips when service workers unavailable', async () => {
    const register = jest.fn();
    await registerProductionServiceWorker({
      register,
      isProduction: true,
      hasServiceWorker: false,
    });
    expect(register).not.toHaveBeenCalled();
  });

  it('registers sw.js in production when supported', async () => {
    const register = jest.fn().mockResolvedValue({} as ServiceWorkerRegistration);
    await registerProductionServiceWorker({
      register,
      isProduction: true,
      hasServiceWorker: true,
    });
    expect(register).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  });

  it('absorbs registration failures', async () => {
    const register = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(
      registerProductionServiceWorker({
        register,
        isProduction: true,
        hasServiceWorker: true,
      })
    ).resolves.toBeUndefined();
  });
});
