import { render, screen } from '@testing-library/react';
import { ToastStack } from '@/components/toastStack/ToastStack';
import { useViewportBreakpoint } from '@/hooks/useViewportBreakpoint';

jest.mock('@/hooks/useViewportBreakpoint', () => ({
  useViewportBreakpoint: jest.fn(),
}));

const mockUseViewportBreakpoint = useViewportBreakpoint as jest.MockedFunction<
  typeof useViewportBreakpoint
>;

describe('ToastStack', () => {
  beforeEach(() => {
    mockUseViewportBreakpoint.mockReturnValue({
      breakpoint: 'desktop',
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    });
  });

  it('renders transient toasts above the pinned progress toast in the stack', () => {
    render(
      <ToastStack
        transients={[{ id: 't-1', message: 'Sync complete' }]}
        pinnedToast={{
          message: 'Categorizing transactions…',
          autoDismiss: false,
          progress: { processed: 2, total: 5 },
        }}
        onDismissTransient={jest.fn()}
        onDismissPinned={jest.fn()}
      />
    );

    const stack = screen.getByTestId('toast-stack');
    const cards = stack.querySelectorAll('[class*="rounded"]');
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Sync complete')).toBeInTheDocument();
    expect(screen.getByText('Categorizing transactions…')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText('40% · 2 / 5')).toBeInTheDocument();
  });

  it('uses mobile layout classes above the floating tab bar', () => {
    mockUseViewportBreakpoint.mockReturnValue({
      breakpoint: 'mobile',
      isMobile: true,
      isTablet: false,
      isDesktop: false,
    });

    render(
      <ToastStack
        transients={[]}
        pinnedToast={{ message: 'Working…', autoDismiss: false }}
        onDismissTransient={jest.fn()}
        onDismissPinned={jest.fn()}
      />
    );

    const stack = screen.getByTestId('toast-stack');
    expect(stack).toHaveAttribute('data-breakpoint', 'mobile');
    expect(stack).toHaveClass('bottom-[calc(5.75rem+env(safe-area-inset-bottom))]');
    expect(stack).toHaveClass('left-[calc(1rem+env(safe-area-inset-left))]');
  });

  it('uses tablet layout classes with bottom chrome clearance', () => {
    mockUseViewportBreakpoint.mockReturnValue({
      breakpoint: 'tablet',
      isMobile: false,
      isTablet: true,
      isDesktop: false,
    });

    render(
      <ToastStack
        transients={[]}
        pinnedToast={{ message: 'Working…', autoDismiss: false }}
        onDismissTransient={jest.fn()}
        onDismissPinned={jest.fn()}
      />
    );

    const stack = screen.getByTestId('toast-stack');
    expect(stack).toHaveAttribute('data-breakpoint', 'tablet');
    expect(stack).toHaveClass('bottom-[calc(4.75rem+env(safe-area-inset-bottom))]');
    expect(stack).toHaveClass('max-w-md');
  });

  it('uses desktop layout classes anchored to the bottom-right', () => {
    render(
      <ToastStack
        transients={[]}
        pinnedToast={{ message: 'Working…', autoDismiss: false }}
        onDismissTransient={jest.fn()}
        onDismissPinned={jest.fn()}
      />
    );

    const stack = screen.getByTestId('toast-stack');
    expect(stack).toHaveAttribute('data-breakpoint', 'desktop');
    expect(stack).toHaveClass('right-6');
    expect(stack).toHaveClass('bottom-6');
    expect(stack).toHaveClass('max-w-lg');
  });
});
