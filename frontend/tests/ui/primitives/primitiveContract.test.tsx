import { render, screen } from '@testing-library/react';
import { Button } from '@/ui/primitives/Button';
import { Input } from '@/ui/primitives/Input';
import { Modal } from '@/ui/primitives/Modal';
import { Select } from '@/ui/primitives/Select';
import { AppTitleBar } from '@/ui/primitives/AppTitleBar';
import { designTokens } from '@/ui/tokens';

const buttonVariants = [
  'primary',
  'secondary',
  'ghost',
  'icon',
  'tab',
  'tabActive',
  'danger',
  'success',
  'connect',
] as const;

const inputVariants = ['default', 'invalid', 'glass'] as const;
const selectVariants = ['default', 'invalid', 'glass'] as const;
const fieldSizes = ['sm', 'md', 'lg'] as const;

const titleBarStates = ['unauthenticated', 'onboarding', 'authenticated'] as const;

describe('primitive contract', () => {
  it('keeps button variant keys aligned with the token recipe contract', () => {
    const tokenKeys = Object.keys(designTokens.components.button).filter((key) => key !== 'base');
    for (const key of buttonVariants) {
      expect(tokenKeys).toContain(key);
    }
  });

  it('renders each button variant without throwing', () => {
    for (const variant of buttonVariants) {
      const size = variant === 'icon' ? 'icon' : 'md';
      const { unmount } = render(
        <Button variant={variant} size={size}>
          {variant}
        </Button>
      );
      expect(screen.getByRole('button', { name: variant })).toBeInTheDocument();
      unmount();
    }
  });

  it('keeps input variant keys aligned with the token recipe contract', () => {
    const tokenVariantKeys = Object.keys(designTokens.components.input).filter(
      (key) => key !== 'base' && key !== 'size'
    );
    for (const key of inputVariants) {
      expect(tokenVariantKeys).toContain(key);
    }
    for (const key of fieldSizes) {
      expect(Object.keys(designTokens.components.input.size)).toContain(key);
    }
  });

  it('renders each input variant and size without throwing', () => {
    for (const variant of inputVariants) {
      for (const inputSize of fieldSizes) {
        const { unmount } = render(
          <Input variant={variant} inputSize={inputSize} defaultValue="" aria-label={`${variant}-${inputSize}`} />
        );
        expect(screen.getByLabelText(`${variant}-${inputSize}`)).toBeInTheDocument();
        unmount();
      }
    }
  });

  it('keeps select variant keys aligned with the token recipe contract', () => {
    const tokenVariantKeys = Object.keys(designTokens.components.select).filter(
      (key) => key !== 'base' && key !== 'size'
    );
    for (const key of selectVariants) {
      expect(tokenVariantKeys).toContain(key);
    }
    for (const key of fieldSizes) {
      expect(Object.keys(designTokens.components.select.size)).toContain(key);
    }
  });

  it('renders each select variant and size without throwing', () => {
    for (const variant of selectVariants) {
      for (const selectSize of fieldSizes) {
        const { unmount } = render(
          <Select variant={variant} selectSize={selectSize} aria-label={`${variant}-${selectSize}`}>
            <option value="a">a</option>
          </Select>
        );
        expect(screen.getByLabelText(`${variant}-${selectSize}`)).toBeInTheDocument();
        unmount();
      }
    }
  });

  it('renders modal dialog for each content width preset without throwing', () => {
    const sizes = ['sm', 'md', 'lg'] as const;
    for (const size of sizes) {
      const { unmount } = render(
        <Modal isOpen size={size} labelledBy={`modal-${size}`}>
          <h2 id={`modal-${size}`}>{size}</h2>
        </Modal>
      );
      expect(screen.getByRole('dialog', { name: size })).toBeInTheDocument();
      unmount();
    }
  });

  it('renders each AppTitleBar state without throwing', () => {
    for (const state of titleBarStates) {
      const { unmount } = render(
        <AppTitleBar
          state={state}
          scrolled={false}
          themeMode="light"
          onThemeToggle={() => {}}
          onLogout={state === 'unauthenticated' ? undefined : () => {}}
          currentTab={state === 'authenticated' ? 'dashboard' : undefined}
          onTabChange={state === 'authenticated' ? () => {} : undefined}
        />
      );
      expect(screen.getByText('Sumurai')).toBeInTheDocument();
      unmount();
    }
  });
});
