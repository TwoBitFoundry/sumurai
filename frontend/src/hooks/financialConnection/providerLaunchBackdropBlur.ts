const PROVIDER_LAUNCH_BACKDROP_BLUR_CLASS = 'provider-launch-backdrop-blur-active';

let activeProviderLaunchBackdropBlurCount = 0;

const syncProviderLaunchBackdropBlurClass = (): void => {
  if (typeof document === 'undefined') {
    return;
  }

  document.body.classList.toggle(
    PROVIDER_LAUNCH_BACKDROP_BLUR_CLASS,
    activeProviderLaunchBackdropBlurCount > 0
  );
};

export const acquireProviderLaunchBackdropBlur = (): (() => void) => {
  if (typeof document === 'undefined') {
    return () => {};
  }

  activeProviderLaunchBackdropBlurCount += 1;
  syncProviderLaunchBackdropBlurClass();

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    activeProviderLaunchBackdropBlurCount = Math.max(0, activeProviderLaunchBackdropBlurCount - 1);
    syncProviderLaunchBackdropBlurClass();
  };
};

export const resetProviderLaunchBackdropBlurForTests = (): void => {
  activeProviderLaunchBackdropBlurCount = 0;
  syncProviderLaunchBackdropBlurClass();
};
