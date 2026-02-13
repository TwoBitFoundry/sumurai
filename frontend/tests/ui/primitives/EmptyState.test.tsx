import { render, screen } from '@testing-library/react';
import { AlertCircle, Receipt, Target, TrendingUp } from 'lucide-react';
import { EmptyState } from '@/ui/primitives/EmptyState';

describe('EmptyState', () => {
  describe('basic rendering', () => {
    it('renders with title and description', () => {
      render(<EmptyState icon={Target} title="No items" description="Create your first item" />);

      expect(screen.getByText('No items')).toBeInTheDocument();
      expect(screen.getByText('Create your first item')).toBeInTheDocument();
    });

    it('renders icon correctly', () => {
      const { container } = render(
        <EmptyState icon={Target} title="Test" description="Description" />
      );

      const iconSvg = container.querySelector('svg');
      expect(iconSvg).toBeInTheDocument();
    });

    it('renders without action when not provided', () => {
      render(<EmptyState icon={Target} title="No items" description="Create your first item" />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('renders with action when provided', () => {
      render(
        <EmptyState
          icon={Target}
          title="No items"
          description="Create your first item"
          action={<button>Create Item</button>}
        />
      );

      expect(screen.getByRole('button', { name: /create item/i })).toBeInTheDocument();
    });
  });

  describe('different icons', () => {
    it('renders with Target icon', () => {
      const { container } = render(
        <EmptyState icon={Target} title="Test" description="Description" />
      );

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with Receipt icon', () => {
      const { container } = render(
        <EmptyState icon={Receipt} title="Test" description="Description" />
      );

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with TrendingUp icon', () => {
      const { container } = render(
        <EmptyState icon={TrendingUp} title="Test" description="Description" />
      );

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with AlertCircle icon', () => {
      const { container } = render(
        <EmptyState icon={AlertCircle} title="Test" description="Description" />
      );

      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('renders with correct class structure', () => {
      const { container } = render(
        <EmptyState icon={Target} title="Test" description="Description" />
      );

      const rootDiv = container.firstChild;
      expect(rootDiv).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center');
    });

    it('applies custom className', () => {
      const { container } = render(
        <EmptyState icon={Target} title="Test" description="Description" className="custom-class" />
      );

      const rootDiv = container.firstChild;
      expect(rootDiv).toHaveClass('custom-class');
    });
  });

  describe('accessibility', () => {
    it('renders title as visible text', () => {
      render(
        <EmptyState icon={Target} title="No budgets" description="Create your first budget" />
      );

      const title = screen.getByText('No budgets');
      expect(title).toBeVisible();
    });

    it('renders description as visible text', () => {
      render(
        <EmptyState icon={Target} title="No budgets" description="Create your first budget" />
      );

      const description = screen.getByText('Create your first budget');
      expect(description).toBeVisible();
    });
  });

  describe('snapshots', () => {
    it('matches snapshot with basic props', () => {
      const { container } = render(
        <EmptyState icon={Target} title="No items" description="Create your first item" />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot with action', () => {
      const { container } = render(
        <EmptyState
          icon={Receipt}
          title="No transactions"
          description="No transaction data available"
          action={<button>Import</button>}
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('matches snapshot with custom className', () => {
      const { container } = render(
        <EmptyState
          icon={TrendingUp}
          title="No data"
          description="No data available"
          className="mt-8"
        />
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
