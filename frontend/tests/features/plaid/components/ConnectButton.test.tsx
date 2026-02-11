import { fireEvent, render } from '@testing-library/react';
import ConnectButton from '@/features/plaid/components/ConnectButton';

describe('ConnectButton', () => {
  it('renders label and triggers onClick', () => {
    const onClick = jest.fn();
    const { getByRole } = render(<ConnectButton onClick={onClick} />);

    const button = getByRole('button', { name: /add account/i });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalled();
  });

  it('supports secondary variant', () => {
    const { getAllByRole } = render(<ConnectButton onClick={() => {}} variant="secondary" />);

    const buttons = getAllByRole('button', { name: /add account/i });
    const button = buttons[buttons.length - 1];
    expect(button.className).toContain('border');
  });
});
