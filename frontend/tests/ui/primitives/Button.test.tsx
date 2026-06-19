import { render, screen } from '@testing-library/react';
import type React from 'react';
import { Button } from '@/ui/primitives/Button';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';
import { control, font } from '@/ui/recipes';

function renderButton(ui: React.ReactElement) {
  return render(<ControlTooltipProvider>{ui}</ControlTooltipProvider>);
}

describe('Button', () => {
  it('defaults to the md control size', () => {
    renderButton(<Button>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain(control.height.md);
    expect(button.className).toContain(control.paddingX.md);
    expect(button.className).toContain(font.bodyStrong);
    expect(button).not.toHaveAttribute('title');
  });

  it.each([
    ['sm', control.height.sm, control.paddingX.sm, font.captionStrong],
    ['md', control.height.md, control.paddingX.md, font.bodyStrong],
    ['lg', control.height.lg, control.paddingX.lg, font.bodyStrong],
  ] as const)('renders the %s control size', (_, height, paddingX, label) => {
    renderButton(<Button size={_}>Submit</Button>);

    const button = screen.getByRole('button', { name: 'Submit' });
    expect(button.className).toContain(height);
    expect(button.className).toContain(paddingX);
    expect(button.className).toContain(label);
  });

  it('renders filter chip pills with shared button affordances', () => {
    renderButton(
      <Button variant="filterChip" size="sm" shape="pill">
        Food
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Food' });
    expect(button.className).toContain('rounded-full');
    expect(button.className).toContain('cursor-pointer');
    expect(button.className).toContain('focus-visible:ring-2');
    expect(button.className).toContain('active:scale-[0.98]');
    expect(button.className).not.toContain('drop-shadow-');
  });

  it.each([
    ['secondary', 'secondary' as const],
    ['ghost', 'ghost' as const],
    ['danger', 'danger' as const],
    ['icon', 'icon' as const],
    ['tab', 'tab' as const],
    ['tabActive', 'tabActive' as const],
  ])('keeps %s buttons free of elevation drop shadow', (_, variant) => {
    renderButton(
      <Button variant={variant} size="md">
        Action
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Action' });
    expect(button.className).not.toMatch(/drop-shadow-\[0_(8|10|12|14|-6|-8|-10)/);
    expect(button.className).not.toContain('hover:drop-shadow-[0_10px');
    expect(button.className).not.toContain(
      'drop-shadow-[0_8px_32px_color-mix(in_srgb,var(--color-effect-glass-shadow)_22%,transparent)]'
    );
  });

  it.each([
    ['primary', 'primary' as const, '--color-effect-accent-outline-glow'],
    ['success', 'success' as const, '--color-effect-success-glow'],
    ['connect', 'connect' as const, '--color-effect-accent-outline-glow'],
    ['tabActive', 'tabActive' as const, '--color-effect-accent-outline-glow'],
  ])('uses CTA glow on %s buttons', (_, variant, glowToken) => {
    renderButton(
      <Button variant={variant} size="md">
        Action
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Action' });
    expect(button.className).toContain(glowToken);
    expect(button.className).toMatch(/drop-shadow-\[0_0_12px/);
    expect(button.className).not.toMatch(/drop-shadow-\[0_(8|10|12|14|-6|-8|-10)/);
  });

  it('uses flat brand sky for the primary variant', () => {
    renderButton(
      <Button variant="primary" size="md">
        Categorize
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Categorize' });
    expect(button.className).toContain('bg-[var(--color-brand-sky)]');
    expect(button.className).toContain('--color-effect-accent-outline-glow');
    expect(button.className).not.toContain('bg-gradient-to-r');
    expect(button.className).not.toContain('to-violet-500');
  });

  it('renders square controls with the shared square recipe', () => {
    renderButton(
      <Button size="md" shape="square">
        Edit
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button.className).toContain(control.square.md);
    expect(button.className).toContain('p-0');
    expect(button.className).not.toContain(control.paddingX.md);
    expect(button.querySelector('span')?.className).toContain(control.glyph.md);
  });
});
