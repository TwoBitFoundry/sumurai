import { render, screen } from '@testing-library/react';
import { ProviderSdkLaunchBackdrop } from '@/components/ProviderSdkLaunchBackdrop';

describe('ProviderSdkLaunchBackdrop', () => {
  it('renders a fixed blurred layer in a portal without blocking pointer events', () => {
    render(<ProviderSdkLaunchBackdrop active />);

    const backdrop = screen.getByTestId('provider-sdk-launch-backdrop');
    expect(backdrop.parentElement).toBe(document.body);
    expect(document.body.dataset.providerSdkInset).toBe('active');
    expect(backdrop.className).toContain('pointer-events-none');
    expect(backdrop.className).toContain('backdrop-blur-[6px]');
    expect(backdrop.className).toContain('fixed');
    expect(backdrop.className).toContain('opacity-100');
  });

  it('hides the blur layer when inactive', () => {
    render(<ProviderSdkLaunchBackdrop active={false} />);

    expect(document.body.dataset.providerSdkInset).toBeUndefined();
    expect(screen.getByTestId('provider-sdk-launch-backdrop').className).toContain('opacity-0');
    expect(screen.getByTestId('provider-sdk-launch-backdrop').className).not.toContain(
      'backdrop-blur-[6px]'
    );
  });

  it('clears the inset state on unmount', () => {
    const { unmount } = render(<ProviderSdkLaunchBackdrop active />);

    expect(document.body.dataset.providerSdkInset).toBe('active');

    unmount();

    expect(document.body.dataset.providerSdkInset).toBeUndefined();
  });
});
