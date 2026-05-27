import { registerProductionServiceWorker } from '@/pwa/registerProductionServiceWorker';

describe('registerProductionServiceWorker', () => {
  it('skips when service workers unavailable', async () => {
    const register = jest.fn();
    await registerProductionServiceWorker({
      register,
      fetch: jest.fn(),
      hasServiceWorker: true,
      isProduction: false,
    });
    expect(register).not.toHaveBeenCalled();
  });

  it('skips when service workers are unavailable', async () => {
    const register = jest.fn();
    await registerProductionServiceWorker({
      register,
      fetch: jest.fn(),
      hasServiceWorker: false,
      isProduction: true,
    });
    expect(register).not.toHaveBeenCalled();
  });

  it('skips outside production', async () => {
    const register = jest.fn();
    await registerProductionServiceWorker({
      register,
      fetch: jest.fn(),
      hasServiceWorker: true,
      isProduction: false,
    });
    expect(register).not.toHaveBeenCalled();
  });

  it('skips when /sw.js is missing', async () => {
    const register = jest.fn();
    const fetch = jest.fn().mockResolvedValue({ ok: false } as Response);
    await registerProductionServiceWorker({
      register,
      fetch,
      hasServiceWorker: true,
      isProduction: true,
    });
    expect(register).not.toHaveBeenCalled();
  });

  it('registers /sw.js when supported and present', async () => {
    const register = jest.fn().mockResolvedValue({} as ServiceWorkerRegistration);
    const fetch = jest.fn().mockResolvedValue({ ok: true } as Response);
    await registerProductionServiceWorker({
      register,
      fetch,
      hasServiceWorker: true,
      isProduction: true,
    });
    expect(register).toHaveBeenCalledWith('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  });

  it('absorbs registration failures', async () => {
    const fetch = jest.fn().mockResolvedValue({ ok: true } as Response);
    const register = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(
      registerProductionServiceWorker({
        register,
        fetch,
        hasServiceWorker: true,
        isProduction: true,
      })
    ).resolves.toBeUndefined();
  });
});
