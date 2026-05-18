import { render } from '@testing-library/react';
import { LoginScreen, RegisterScreen } from '@/Auth';

jest.mock('@/hooks/useRegistrationValidation', () => ({
  useRegistrationValidation: jest.fn(() => ({
    email: '',
    password: '',
    confirmPassword: '',
    isEmailValid: false,
    passwordValidation: {
      minLength: false,
      hasCapital: false,
      hasNumber: false,
      hasSpecial: false,
      isValid: false,
    },
    isPasswordMatch: false,
    setEmail: jest.fn(),
    setPassword: jest.fn(),
    setConfirmPassword: jest.fn(),
    validateForm: jest.fn(),
  })),
}));

describe('Auth screens', () => {
  it('keeps login shell padding on the md tier', () => {
    const { container } = render(<LoginScreen onNavigateToRegister={jest.fn()} />);

    expect(container.firstElementChild).toHaveClass('md:px-6');
    expect(container.firstElementChild).not.toHaveClass('sm:px-6');
  });

  it('keeps register shell padding on the md tier', () => {
    const { container } = render(<RegisterScreen onNavigateToLogin={jest.fn()} />);

    expect(container.firstElementChild).toHaveClass('md:px-6');
    expect(container.firstElementChild).not.toHaveClass('sm:px-6');
  });
});
