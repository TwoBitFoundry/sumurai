import { render, screen } from '@testing-library/react';
import { GradientShell } from '@/ui/primitives/GradientShell';

describe('GradientShell', () => {
  it('renders one static full-viewport mesh behind its content', () => {
    const { container } = render(
      <GradientShell>
        <span>Shell content</span>
      </GradientShell>
    );

    const mesh = container.querySelector('[data-slot="gradient-shell-mesh"]');

    expect(mesh).toHaveClass('fixed', 'inset-0', 'gradient-shell-mesh');
    expect(mesh).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('[class*="animate-"]')).toBeNull();
    expect(screen.getByText('Shell content')).toBeVisible();
  });

  it('keeps the mesh and content scoped to a centered shell', () => {
    const { container } = render(
      <GradientShell centered>
        <span>Centered content</span>
      </GradientShell>
    );

    const mesh = container.querySelector('[data-slot="gradient-shell-mesh"]');
    const content = screen.getByText('Centered content').parentElement;

    expect(mesh).toHaveClass('absolute', 'inset-0');
    expect(content).toHaveClass('flex', 'min-h-dvh', 'px-4', 'md:px-6');
    expect(content).not.toHaveClass('sm:px-6');
  });
});
