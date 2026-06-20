import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageLayout, pageLayoutRecipes } from '@/layouts/PageLayout';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';

describe('PageLayout', () => {
  it('keeps the shell spacing on the base, md, and lg tiers', () => {
    const shell = pageLayoutRecipes.shell.join(' ');

    expect(shell).toContain('p-4');
    expect(shell).toContain('md:p-8');
    expect(shell).toContain('lg:p-8');
    expect(shell).not.toContain('sm:p-8');
    expect(shell).not.toContain('xl:');
    expect(shell).not.toContain('2xl:');
  });

  it('uses box elevation shadow on the header shell surface without filter drop shadow', () => {
    const shellSurface = pageLayoutRecipes.shellSurface.join(' ');

    expect(shellSurface).toContain('shadow-[0_8px_32px');
    expect(shellSurface).not.toContain('drop-shadow-[');
  });

  it('renders hero subtitles behind an info popover trigger', async () => {
    const user = userEvent.setup();
    const subtitle = 'Track your total balances and net worth across accounts.';

    render(
      <ControlTooltipProvider>
        <PageLayout title="Assess your financial health" subtitle={subtitle} />
      </ControlTooltipProvider>
    );

    expect(screen.queryByText(subtitle)).not.toBeInTheDocument();

    const heading = screen.getByRole('heading', { level: 1 });
    const titleHost = heading.parentElement;
    expect(titleHost?.className).toContain('inline');
    expect(titleHost?.className).not.toContain('inline-flex');
    expect(titleHost?.className).toContain('text-[2rem]');
    expect(titleHost?.className).toContain('leading-[1.1]');
    expect(heading.className).toContain('inline');
    expect(heading.className).not.toContain('text-[2rem]');
    expect(heading).toHaveTextContent('Assess your financial health');
    await user.click(screen.getByRole('button', { name: 'About Assess your financial health' }));

    expect(screen.getByText(subtitle)).toBeInTheDocument();
  });
});
