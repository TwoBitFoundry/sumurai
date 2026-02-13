import { useMemo } from 'react';

export interface PasswordValidation {
  minLength: boolean;
  hasCapital: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

export function usePasswordValidation(password: string): PasswordValidation {
  return useMemo(() => {
    const minLength = password.length >= 8;
    const hasCapital = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return {
      minLength,
      hasCapital,
      hasNumber,
      hasSpecial,
      isValid: minLength && hasCapital && hasNumber && hasSpecial,
    };
  }, [password]);
}
