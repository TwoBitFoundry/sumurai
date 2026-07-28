import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { createRef } from 'react';
import {
  DeleteCustomCategoryConfirm,
  isDeleteCustomCategoryConfirmTarget,
} from '@/features/transactions/components/DeleteCustomCategoryConfirm';

jest.mock('@/features/transactions/hooks/useDeleteCustomCategory', () => ({
  useDeleteCustomCategory: jest.fn(),
}));

const useDeleteCustomCategoryMock = jest.requireMock(
  '@/features/transactions/hooks/useDeleteCustomCategory'
) as typeof import('@/features/transactions/hooks/useDeleteCustomCategory');

function renderDeleteConfirm(
  props: Partial<ComponentProps<typeof DeleteCustomCategoryConfirm>> = {}
) {
  const anchorRef = createRef<HTMLButtonElement>();
  const anchor = document.createElement('button');
  anchor.getBoundingClientRect = () => ({
    top: 400,
    left: 200,
    width: 24,
    height: 24,
    right: 224,
    bottom: 424,
    x: 200,
    y: 400,
    toJSON: () => ({}),
  });
  anchorRef.current = anchor;

  const result = render(
    <DeleteCustomCategoryConfirm
      open
      anchorRef={anchorRef}
      category={{ id: 'custom-1', display_name: 'Coffee', lookup_key: 'coffee' }}
      onRequestClose={jest.fn()}
      {...props}
    />
  );

  return { anchorRef, ...result };
}

describe('DeleteCustomCategoryConfirm', () => {
  const deleteCustomCategoryAsync = jest.fn();
  const onRequestClose = jest.fn();

  it('marks the portaled confirmation as exempt from parent dismiss handlers', () => {
    renderDeleteConfirm({ onRequestClose });

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(isDeleteCustomCategoryConfirmTarget(deleteButton)).toBe(true);
    expect(isDeleteCustomCategoryConfirmTarget(document.body)).toBe(false);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useDeleteCustomCategoryMock.useDeleteCustomCategory).mockReturnValue({
      deleteCustomCategory: jest.fn(),
      deleteCustomCategoryAsync,
      isPending: false,
      error: null,
    });
  });

  it('renders as a floating popover above the delete trigger', () => {
    renderDeleteConfirm({ onRequestClose });

    const popover = screen.getByTestId('delete-custom-category-popover');
    expect(popover).toHaveAttribute('data-delete-custom-category-confirm');
    expect(popover).toHaveClass('fixed', 'z-50');
    expect(popover.style.bottom).toBeTruthy();
    expect(popover.style.left).toBeTruthy();
  });

  it('keeps the popover clamped in view when the anchor is near the viewport edge', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 844,
    });

    const anchorRef = createRef<HTMLButtonElement>();
    const anchor = document.createElement('button');
    anchor.getBoundingClientRect = () => ({
      top: 900,
      left: 8,
      width: 24,
      height: 24,
      right: 32,
      bottom: 924,
      x: 8,
      y: 900,
      toJSON: () => ({}),
    });
    anchorRef.current = anchor;

    render(
      <DeleteCustomCategoryConfirm
        open
        anchorRef={anchorRef}
        category={{ id: 'custom-1', display_name: 'Kelci', lookup_key: 'kelci' }}
        onRequestClose={jest.fn()}
      />
    );

    expect(screen.getByTestId('delete-custom-category-popover').style.left).toBe('176px');
  });

  it('renders the confirmation copy and closes after delete succeeds', async () => {
    const user = userEvent.setup();
    deleteCustomCategoryAsync.mockResolvedValue(undefined);

    renderDeleteConfirm({ onRequestClose });

    expect(screen.getByText("Delete 'Coffee'?")).toBeVisible();
    expect(
      screen.getByText(
        'Transactions in this category will fall back to their original assigned category.'
      )
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteCustomCategoryAsync).toHaveBeenCalledWith('custom-1');
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('closes when Escape is pressed', () => {
    renderDeleteConfirm({ onRequestClose });

    fireEvent.keyDown(screen.getByTestId('delete-custom-category-popover'), {
      key: 'Escape',
    });

    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('shows the pending state inline', () => {
    jest.mocked(useDeleteCustomCategoryMock.useDeleteCustomCategory).mockReturnValue({
      deleteCustomCategory: jest.fn(),
      deleteCustomCategoryAsync,
      isPending: true,
      error: null,
    });

    renderDeleteConfirm({ onRequestClose });

    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel delete category' })).toBeDisabled();
  });

  it('shows the error inline when the delete fails', () => {
    jest.mocked(useDeleteCustomCategoryMock.useDeleteCustomCategory).mockReturnValue({
      deleteCustomCategory: jest.fn(),
      deleteCustomCategoryAsync,
      isPending: false,
      error: new Error('Nope'),
    });

    renderDeleteConfirm({ onRequestClose });

    expect(screen.getByText('Nope')).toBeVisible();
  });
});
