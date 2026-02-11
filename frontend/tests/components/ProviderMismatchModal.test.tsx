import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProviderMismatchModal } from '@/components/ProviderMismatchModal';

describe('ProviderMismatchModal', () => {
  const mockOnConfirm = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Given user signed up with Teller but environment is Plaid', () => {
    it('should display provider configuration mismatch title', () => {
      render(
        <ProviderMismatchModal
          userProvider="teller"
          defaultProvider="plaid"
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(/provider configuration mismatch/i)).toBeInTheDocument();
    });

    it('should show user provider as Teller and default as Plaid', () => {
      render(
        <ProviderMismatchModal
          userProvider="teller"
          defaultProvider="plaid"
          onConfirm={mockOnConfirm}
        />
      );

      const description = screen.getByText(/Your account is configured to use/i);
      expect(description).toBeInTheDocument();
      expect(screen.getByText('Teller')).toBeInTheDocument();
      expect(screen.getByText('Plaid')).toBeInTheDocument();
    });

    it('should display instruction to update DEFAULT_PROVIDER to teller', () => {
      render(
        <ProviderMismatchModal
          userProvider="teller"
          defaultProvider="plaid"
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(/DEFAULT_PROVIDER=teller/i)).toBeInTheDocument();
      expect(screen.getByText(/update your environment to set/i)).toBeInTheDocument();
    });

    it('should display alert icon', () => {
      const { container } = render(
        <ProviderMismatchModal
          userProvider="teller"
          defaultProvider="plaid"
          onConfirm={mockOnConfirm}
        />
      );

      const alertIcon = container.querySelector('svg');
      expect(alertIcon).toBeInTheDocument();
    });

    it('should render Sign Out button', () => {
      render(
        <ProviderMismatchModal
          userProvider="teller"
          defaultProvider="plaid"
          onConfirm={mockOnConfirm}
        />
      );

      const signOutButton = screen.getByRole('button', { name: /sign out/i });
      expect(signOutButton).toBeInTheDocument();
    });

    it('should call onConfirm when Sign Out button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <ProviderMismatchModal
          userProvider="teller"
          defaultProvider="plaid"
          onConfirm={mockOnConfirm}
        />
      );

      const signOutButton = screen.getByRole('button', { name: /sign out/i });
      await user.click(signOutButton);

      expect(mockOnConfirm).toHaveBeenCalledOnce();
    });
  });

  describe('Given user signed up with Plaid but environment is Teller', () => {
    it('should show user provider as Plaid and default as Teller', () => {
      render(
        <ProviderMismatchModal
          userProvider="plaid"
          defaultProvider="teller"
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Plaid')).toBeInTheDocument();
      expect(screen.getByText('Teller')).toBeInTheDocument();
    });

    it('should display instruction to update DEFAULT_PROVIDER to plaid', () => {
      render(
        <ProviderMismatchModal
          userProvider="plaid"
          defaultProvider="teller"
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(/DEFAULT_PROVIDER=plaid/i)).toBeInTheDocument();
    });
  });

  describe('Modal behavior', () => {
    it('should render modal with backdrop overlay', () => {
      const { container } = render(
        <ProviderMismatchModal
          userProvider="teller"
          defaultProvider="plaid"
          onConfirm={mockOnConfirm}
        />
      );

      const backdrop = container.querySelector('.fixed.inset-0');
      expect(backdrop).toBeInTheDocument();
    });

    it('should have high z-index to appear above other content', () => {
      const { container } = render(
        <ProviderMismatchModal
          userProvider="teller"
          defaultProvider="plaid"
          onConfirm={mockOnConfirm}
        />
      );

      const modal = container.querySelector('.z-50');
      expect(modal).toBeInTheDocument();
    });

    it('should not be dismissible by clicking outside', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <ProviderMismatchModal
          userProvider="teller"
          defaultProvider="plaid"
          onConfirm={mockOnConfirm}
        />
      );

      const backdrop = container.querySelector('.absolute.inset-0');
      if (backdrop) {
        await user.click(backdrop);
      }

      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Dark mode support', () => {
    it('should include dark mode classes for styling', () => {
      const { container } = render(
        <div className="dark">
          <ProviderMismatchModal
            userProvider="teller"
            defaultProvider="plaid"
            onConfirm={mockOnConfirm}
          />
        </div>
      );

      const modalCard = container.querySelector('[class*="dark:"]');
      expect(modalCard).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button', () => {
      render(
        <ProviderMismatchModal
          userProvider="teller"
          defaultProvider="plaid"
          onConfirm={mockOnConfirm}
        />
      );

      const button = screen.getByRole('button', { name: /sign out/i });
      expect(button).toHaveAccessibleName();
    });

    it('should display clear and informative error messaging', () => {
      render(
        <ProviderMismatchModal
          userProvider="teller"
          defaultProvider="plaid"
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(/Your account is configured to use/i)).toBeInTheDocument();
      expect(screen.getByText(/update your environment to set/i)).toBeInTheDocument();
    });
  });

  describe('Provider label mapping', () => {
    it('should display capitalized provider names', () => {
      render(
        <ProviderMismatchModal
          userProvider="plaid"
          defaultProvider="teller"
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Plaid')).toBeInTheDocument();
      expect(screen.getByText('Teller')).toBeInTheDocument();
    });

    it('should handle unknown provider gracefully', () => {
      render(
        <ProviderMismatchModal
          userProvider="unknown"
          defaultProvider="plaid"
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(/DEFAULT_PROVIDER=unknown/i)).toBeInTheDocument();
    });
  });
});
