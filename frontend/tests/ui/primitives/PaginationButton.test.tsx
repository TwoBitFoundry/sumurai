import { render, screen } from '@testing-library/react';
import React from 'react';
import { PaginationButton } from '@/ui/primitives/PaginationButton';
import { control } from '@/ui/recipes';

describe('PaginationButton', () => {
  it('uses the shared sm square control', () => {
    render(
      <PaginationButton aria-label="Next page">
        <span aria-hidden="true">N</span>
      </PaginationButton>
    );

    expect(screen.getByRole('button', { name: 'Next page' }).className).toContain(
      control.square.sm
    );
  });
});
