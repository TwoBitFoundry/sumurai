import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeModeSelector } from '@/components/ThemeModeSelector';

describe('ThemeModeSelector', () => {
  it('uses context pill chrome on all breakpoints', () => {
    render(<ThemeModeSelector value="system" onChange={jest.fn()} />);

    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(group.className).toContain('h-12');
    expect(group.className).toContain('md:h-9');
    expect(group.className).toContain('lg:h-8');
    expect(group.className).toContain('md:py-1');

    const system = screen.getByRole('radio', { name: 'System' });
    expect(system.className).toContain('rounded-lg');
    expect(system).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange when a mode is selected', () => {
    const onChange = jest.fn();
    render(<ThemeModeSelector value="system" onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });
});
