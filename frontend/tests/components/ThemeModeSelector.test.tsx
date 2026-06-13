import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeModeSelector } from '@/components/ThemeModeSelector';

jest.mock('framer-motion', () => {
  const R = require('react');
  return {
    motion: {
      div: ({ layoutId, transition, children, 'data-testid': testId, ...props }: any) =>
        R.createElement('div', { 'data-testid': testId, ...props }, children),
    },
  };
});

describe('ThemeModeSelector', () => {
  it('uses context pill chrome on all breakpoints', () => {
    render(<ThemeModeSelector value="system" onChange={jest.fn()} />);

    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(group.className).not.toContain('drop-shadow-[');
    expect(group.className).toContain('h-12');
    expect(group.className).toContain('md:h-9');
    expect(group.className).toContain('lg:h-8');
    expect(group.className).toContain('md:py-1');

    const system = screen.getByRole('radio', { name: 'System' });
    expect(system.className).toContain('rounded-lg');
    expect(system).toHaveAttribute('aria-checked', 'true');
    expect(system.querySelector('[data-slot="active-pill"]')).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'false');
  });

  it('moves the active pill when the selected mode changes', () => {
    const { rerender } = render(<ThemeModeSelector value="system" onChange={jest.fn()} />);

    expect(
      screen.getByRole('radio', { name: 'System' }).querySelector('[data-slot="active-pill"]')
    ).not.toBeNull();
    expect(
      screen.getByRole('radio', { name: 'Light' }).querySelector('[data-slot="active-pill"]')
    ).toBeNull();

    rerender(<ThemeModeSelector value="light" onChange={jest.fn()} />);

    expect(
      screen.getByRole('radio', { name: 'System' }).querySelector('[data-slot="active-pill"]')
    ).toBeNull();
    expect(
      screen.getByRole('radio', { name: 'Light' }).querySelector('[data-slot="active-pill"]')
    ).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange when a mode is selected', () => {
    const onChange = jest.fn();
    render(<ThemeModeSelector value="system" onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });
});
