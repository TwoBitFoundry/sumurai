import { act, render, screen } from '@testing-library/react';
import { ProviderSdkLaunchBackdrop } from '@/components/ProviderSdkLaunchBackdrop';

describe('ProviderSdkLaunchBackdrop', () => {
  const setViewport = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
  };

  beforeEach(() => {
    setViewport(1024);
    delete document.body.dataset.providerSdkInset;
  });

  it('renders a fixed blurred layer in a portal without blocking pointer events', () => {
    setViewport(390);
    render(<ProviderSdkLaunchBackdrop active />);

    const backdrop = screen.getByTestId('provider-sdk-launch-backdrop');
    expect(backdrop.parentElement).toBe(document.body);
    expect(document.body.dataset.providerSdkInset).toBe('mobile');
    expect(backdrop.className).toContain('pointer-events-none');
    expect(backdrop.className).toContain('backdrop-blur-[6px]');
    expect(backdrop.className).toContain('fixed');
    expect(backdrop.className).toContain('opacity-100');
  });

  it('sets the tablet dataset value when active on tablet', () => {
    setViewport(820);
    render(<ProviderSdkLaunchBackdrop active />);

    expect(document.body.dataset.providerSdkInset).toBe('tablet');
  });

  it('removes the dataset on desktop and when inactive', () => {
    render(<ProviderSdkLaunchBackdrop active={false} />);

    expect(document.body.dataset.providerSdkInset).toBeUndefined();
    expect(screen.getByTestId('provider-sdk-launch-backdrop').className).toContain('opacity-0');
    expect(screen.getByTestId('provider-sdk-launch-backdrop').className).not.toContain(
      'backdrop-blur-[6px]'
    );

    setViewport(1200);
    const { rerender } = render(<ProviderSdkLaunchBackdrop active />);
    expect(document.body.dataset.providerSdkInset).toBeUndefined();

    rerender(<ProviderSdkLaunchBackdrop active={false} />);
    expect(document.body.dataset.providerSdkInset).toBeUndefined();
  });

  it('clears the inset state on unmount', () => {
    setViewport(390);
    const { unmount } = render(<ProviderSdkLaunchBackdrop active />);

    expect(document.body.dataset.providerSdkInset).toBe('mobile');

    unmount();

    expect(document.body.dataset.providerSdkInset).toBeUndefined();
  });

  it('tracks breakpoint changes while mounted', () => {
    setViewport(390);
    render(<ProviderSdkLaunchBackdrop active />);

    expect(document.body.dataset.providerSdkInset).toBe('mobile');

    act(() => {
      setViewport(820);
      window.dispatchEvent(new Event('resize'));
    });

    expect(document.body.dataset.providerSdkInset).toBe('tablet');

    act(() => {
      setViewport(1200);
      window.dispatchEvent(new Event('orientationchange'));
    });

    expect(document.body.dataset.providerSdkInset).toBeUndefined();
  });
});
