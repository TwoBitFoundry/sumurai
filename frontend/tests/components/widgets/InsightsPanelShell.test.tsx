import { render, screen } from '@testing-library/react';
import { InsightsPanelShell } from '@/components/widgets/InsightsPanelShell';

function expectGlassInsightsSurface(surface: Element | null | undefined) {
  expect(surface).toBeTruthy();
  expect(surface?.className).toContain('backdrop-blur-md');
  expect(surface?.className).toContain('--color-surface-glass-panel');
  expect(surface).not.toHaveClass('border-0');
  expect(surface).not.toHaveClass('bg-white/80');
}

describe('InsightsPanelShell', () => {
  it('renders a sticky wrapper with a glass clipped inner shell', () => {
    render(
      <InsightsPanelShell testId="insights-shell" accent="ocean">
        <div data-testid="insights-content">Content</div>
      </InsightsPanelShell>
    );

    const shell = screen.getByTestId('insights-shell');

    expect(shell).toHaveClass('sticky');
    expect(shell).toHaveClass('z-30');
    expect(shell.className).toContain('top-[calc(');
    expect(shell.className).toContain('md:top-[calc(');
    expect(shell.className).toContain('lg:top-[calc(');
    expect(shell).not.toHaveClass('overflow-hidden');

    expectGlassInsightsSurface(shell.firstElementChild);
    expect(shell.firstElementChild?.className ?? '').toContain('shadow-[0_8px_32px');
    expect(shell.firstElementChild?.className ?? '').not.toContain('drop-shadow-[');
    expect(shell.querySelector('.hero-stat-card__gradient')).toBeTruthy();
    expect(shell.querySelector('.hero-stat-card__inset-ring')).toBeTruthy();
    expect(screen.getByTestId('insights-content')).toBeInTheDocument();
  });
});
