import { resetDevelopmentServiceWorkers } from '@/pwa/resetDevelopmentServiceWorkers';

describe('resetDevelopmentServiceWorkers', () => {
  it('clears the reload marker when no registrations exist', async () => {
    const clearReloadMarker = jest.fn();

    await resetDevelopmentServiceWorkers({
      getRegistrations: jest.fn().mockResolvedValue([]),
      hasController: false,
      reload: jest.fn(),
      getReloadMarker: jest.fn(),
      setReloadMarker: jest.fn(),
      clearReloadMarker,
    });

    expect(clearReloadMarker).toHaveBeenCalledTimes(1);
  });

  it('reloads once when active dev registrations are removed under a controller', async () => {
    const reload = jest.fn();
    const setReloadMarker = jest.fn();

    await resetDevelopmentServiceWorkers({
      getRegistrations: jest
        .fn()
        .mockResolvedValue([
          { unregister: jest.fn().mockResolvedValue(true) } as ServiceWorkerRegistration,
        ]),
      hasController: true,
      reload,
      getReloadMarker: jest.fn().mockReturnValue(null),
      setReloadMarker,
      clearReloadMarker: jest.fn(),
    });

    expect(setReloadMarker).toHaveBeenCalledWith('sumurai-dev-sw-reset');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload twice when the marker is already set', async () => {
    const reload = jest.fn();

    await resetDevelopmentServiceWorkers({
      getRegistrations: jest
        .fn()
        .mockResolvedValue([
          { unregister: jest.fn().mockResolvedValue(true) } as ServiceWorkerRegistration,
        ]),
      hasController: true,
      reload,
      getReloadMarker: jest.fn().mockReturnValue('sumurai-dev-sw-reset'),
      setReloadMarker: jest.fn(),
      clearReloadMarker: jest.fn(),
    });

    expect(reload).not.toHaveBeenCalled();
  });

  it('clears the marker when registrations are removed without a controller', async () => {
    const clearReloadMarker = jest.fn();

    await resetDevelopmentServiceWorkers({
      getRegistrations: jest
        .fn()
        .mockResolvedValue([
          { unregister: jest.fn().mockResolvedValue(true) } as ServiceWorkerRegistration,
        ]),
      hasController: false,
      reload: jest.fn(),
      getReloadMarker: jest.fn(),
      setReloadMarker: jest.fn(),
      clearReloadMarker,
    });

    expect(clearReloadMarker).toHaveBeenCalledTimes(1);
  });
});
