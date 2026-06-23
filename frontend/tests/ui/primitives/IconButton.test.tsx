import { render, screen } from '@testing-library/react';
import type React from 'react';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';
import { IconButton } from '@/ui/primitives/IconButton';
import { chromeBar, control } from '@/ui/recipes';

function renderIconButton(ui: React.ReactElement) {
  return render(<ControlTooltipProvider>{ui}</ControlTooltipProvider>);
}

describe('IconButton', () => {
  it('defaults to the md control square', () => {
    renderIconButton(
      <IconButton aria-label="Settings">
        <span aria-hidden="true">S</span>
      </IconButton>
    );

    const button = screen.getByRole('button', { name: 'Settings' });
    expect(button.className).toContain(control.square.md);
    expect(button.querySelector('span')).not.toBeNull();
    expect(button).not.toHaveAttribute('title');
  });

  it.each([
    ['sm', control.square.sm, control.glyph.sm],
    ['md', control.square.md, control.glyph.md],
    ['lg', control.square.lg, control.glyph.lg],
  ] as const)('renders the %s control size', (size, shell, glyph) => {
    renderIconButton(
      <IconButton aria-label="Action" size={size}>
        <span aria-hidden="true">A</span>
      </IconButton>
    );

    const button = screen.getByRole('button', { name: 'Action' });
    expect(button.className).toContain(shell);
    const glyphShell = button.querySelector('span');
    expect(glyphShell?.className).toContain(glyph);
    expect(glyphShell?.className).toContain('inline-flex');
    expect(glyphShell?.className).toContain('items-center');
    expect(glyphShell?.className).toContain('[&_svg]:h-full');
  });

  it('uses flat brand sky for the primary variant', () => {
    renderIconButton(
      <IconButton variant="primary" aria-label="Add">
        <span aria-hidden="true">+</span>
      </IconButton>
    );

    const button = screen.getByRole('button', { name: 'Add' });
    expect(button.className).toContain('bg-[var(--color-brand-azure)]');
    expect(button.className).not.toContain('bg-gradient-to-r');
    expect(button.className).not.toContain('to-violet-500');
  });

  it('renders the chrome bar size for title bar icon actions', () => {
    renderIconButton(
      <IconButton aria-label="Settings" size="bar">
        <span aria-hidden="true">S</span>
      </IconButton>
    );

    const button = screen.getByRole('button', { name: 'Settings' });
    expect(button.className).toContain(chromeBar.square);
    expect(button.querySelector('span')?.className).toContain('h-6');
    expect(button.querySelector('span')?.className).toContain('w-6');
  });
});
