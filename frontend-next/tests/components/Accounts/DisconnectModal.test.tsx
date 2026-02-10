import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DisconnectModal } from '@/components/DisconnectModal';

const mockBank = {
  id: 'bank-1',
  name: 'Chase Bank',
  short: 'CB',
  status: 'connected' as const,
  lastSync: '2025-08-15T10:00:00Z',
  accounts: [
    {
      id: 'acc-1',
      name: 'Checking Account',
      mask: '1234',
      type: 'checking' as const,
      balance: 1500.5,
      transactions: 25,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('DisconnectModal', () => {
  describe('when modal is closed', () => {
    it('does not render modal content', () => {
      const mockOnConfirm = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <DisconnectModal
          isOpen={false}
          bank={mockBank}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText(/Disconnect Chase Bank/)).not.toBeInTheDocument();
    });
  });

  describe('when modal is open', () => {
    it('displays bank name and warning message', () => {
      const mockOnConfirm = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <DisconnectModal
          isOpen={true}
          bank={mockBank}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText('Disconnect Chase Bank?')).toBeInTheDocument();
      expect(
        screen.getByText(
          (content, element) =>
            content.includes('This will remove') &&
            element?.textContent?.includes('related transactions')
        )
      ).toBeInTheDocument();
    });

    it('shows account count in warning message', () => {
      const mockOnConfirm = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <DisconnectModal
          isOpen={true}
          bank={mockBank}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/1 account/)).toBeInTheDocument();
    });

    it('renders cancel and disconnect buttons', () => {
      const mockOnConfirm = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <DisconnectModal
          isOpen={true}
          bank={mockBank}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    });
  });

  describe('when user interactions occur', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <DisconnectModal
          isOpen={true}
          bank={mockBank}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('calls onConfirm when disconnect button is clicked', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <DisconnectModal
          isOpen={true}
          bank={mockBank}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const disconnectButton = screen.getByRole('button', { name: /disconnect/i });
      await user.click(disconnectButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it('calls onCancel when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const mockOnConfirm = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <DisconnectModal
          isOpen={true}
          bank={mockBank}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const backdrop = screen.getByTestId('modal-backdrop');
      await user.click(backdrop);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('when loading state is active', () => {
    it('disables buttons and shows loading spinner during confirmation', () => {
      const mockOnConfirm = jest.fn();
      const mockOnCancel = jest.fn();

      render(
        <DisconnectModal
          isOpen={true}
          bank={mockBank}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          loading={true}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      const disconnectButton = screen.getByRole('button', { name: /disconnecting/i });

      expect(cancelButton).toBeDisabled();
      expect(disconnectButton).toBeDisabled();
      expect(disconnectButton).toHaveAttribute('disabled');
    });
  });
});
