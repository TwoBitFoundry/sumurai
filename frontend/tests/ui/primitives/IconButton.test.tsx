import { render, screen } from '@testing-library/react';
import React from 'react';
import { IconButton } from '@/ui/primitives/IconButton';
import { control } from '@/ui/recipes';

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
    expect(button.querySelector('span')?.className).toContain(glyph);
  });
});
