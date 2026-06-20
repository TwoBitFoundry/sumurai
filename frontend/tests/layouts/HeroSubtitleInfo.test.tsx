import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeroSubtitleInfo } from '@/layouts/HeroSubtitleInfo';
import { ControlTooltipProvider } from '@/ui/primitives/ControlHoverLabel';

describe('HeroSubtitleInfo', () => {
  it('shows the subtitle in a popover from the inline info button', async () => {
    const user = userEvent.setup();

    render(
      <ControlTooltipProvider>
        <div className="inline min-w-0 max-w-full font-page-title text-[2rem] font-bold leading-[1.1] tracking-normal">
          <h1 className="inline">Assess your financial health</h1>{' '}
          <HeroSubtitleInfo
            pageTitle="Assess your financial health"
            subtitle="Track your total balances and net worth across accounts."
          />
        </div>
      </ControlTooltipProvider>
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Assess your financial health'
    );
    const infoButton = screen.getByRole('button', {
      name: 'About Assess your financial health',
    });

    expect(infoButton.className).toContain('align-middle');
    expect(infoButton.className).toContain('[transform:translateY(-0.06em)]');
    expect(infoButton.className).toContain('h-[0.625em]');
    expect(infoButton.className).toContain('w-[0.625em]');
    expect(
      screen.queryByText('Track your total balances and net worth across accounts.')
    ).not.toBeInTheDocument();

    await user.click(infoButton);

    expect(screen.getByText('About')).toBeInTheDocument();
    expect(
      screen.getByText('Track your total balances and net worth across accounts.')
    ).toBeInTheDocument();
  });
});
