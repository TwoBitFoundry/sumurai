import { render, screen } from '@testing-library/react';
import React from 'react';
import { IconButton } from '@/ui/primitives/IconButton';
import { chromeBar, control } from '@/ui/recipes';

describe('IconButton', () => {
  it('defaults to the md control square', () => {
    render(
      <IconButton aria-label="Settings">
        <span aria-hidden="true">S</span>
      </IconButton>
    );

    const button = screen.getByRole('button', { name: 'Settings' });
    expect(button.className).toContain(control.square.md);
    expect(button.querySelector('span')).not.toBeNull();
  });

  it.each([
    ['sm', control.square.sm, control.glyph.sm],
    ['md', control.square.md, control.glyph.md],
    ['lg', control.square.lg, control.glyph.lg],
  ] as const)('renders the %s control size', (size, shell, glyph) => {
    render(
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

  it('renders the chrome bar size for title bar icon actions', () => {
    render(
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
