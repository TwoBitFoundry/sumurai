import { render, screen } from '@testing-library/react';
import React from 'react';
import { PaginationButton } from '@/ui/primitives/PaginationButton';
import { control } from '@/ui/recipes';

describe('PaginationButton', () => {
  it('defaults to the shared md square control', () => {
    render(
      <PaginationButton aria-label="Next page">
        <span aria-hidden="true">N</span>
      </PaginationButton>
    );

    expect(screen.getByRole('button', { name: 'Next page' }).className).toContain(
      control.square.md
    );
    expect(
      screen.getByRole('button', { name: 'Next page' }).querySelector('span')?.className
    ).toContain(control.glyph.md);
  });

  it('supports the sm square control for dense toolbars', () => {
    render(
      <PaginationButton aria-label="Previous page" size="sm">
        <span aria-hidden="true">P</span>
      </PaginationButton>
    );

    expect(screen.getByRole('button', { name: 'Previous page' }).className).toContain(
      control.square.sm
    );
  });
});
