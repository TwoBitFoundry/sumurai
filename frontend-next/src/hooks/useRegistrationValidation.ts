import { useState, useMemo } from 'react';
import { usePasswordValidation, type PasswordValidation } from './usePasswordValidation';

interface RegistrationValidation {
  email: string;
  password: string;
  confirmPassword: string;
  isEmailValid: boolean;
  passwordValidation: PasswordValidation;
  isPasswordMatch: boolean;
  isFormValid: boolean;
  setEmail: (email: string) => void;
  setPassword: (password: string) => void;
  setConfirmPassword: (confirmPassword: string) => void;
  validateForm: () => string | null;
}

export function useRegistrationValidation(): RegistrationValidation {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isEmailValid = useMemo(() => validateEmail(email), [email]);
  const passwordValidation = usePasswordValidation(password);
  const isPasswordMatch = useMemo(() => password === confirmPassword, [password, confirmPassword]);
  const isFormValid = useMemo(
    () => isEmailValid && passwordValidation.isValid && isPasswordMatch,
    [isEmailValid, passwordValidation.isValid, isPasswordMatch]
  );

  const validateForm = (): string | null => {
    if (!isEmailValid) {
      return 'Please enter a valid email address';
    }

    if (!passwordValidation.isValid) {
      return 'Password does not meet requirements';
    }

    if (!isPasswordMatch) {
      return 'Passwords do not match';
    }

    return null;
  };

  return {
    email,
    password,
    confirmPassword,
    isEmailValid,
    passwordValidation,
    isPasswordMatch,
    isFormValid,
    setEmail,
    setPassword,
    setConfirmPassword,
    validateForm,
  };
}
