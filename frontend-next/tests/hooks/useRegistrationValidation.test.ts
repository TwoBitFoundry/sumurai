import { renderHook, act, cleanup } from '@testing-library/react'
import { useRegistrationValidation } from '@/hooks/useRegistrationValidation'

describe('useRegistrationValidation Hook', () => {
  afterEach(() => {
    cleanup()
  })

  describe('Given the hook is initialized', () => {
    describe('When no values are provided', () => {
      it('Then it should return initial empty state with form invalid', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        expect(result.current.email).toBe('')
        expect(result.current.password).toBe('')
        expect(result.current.confirmPassword).toBe('')
        expect(result.current.isFormValid).toBe(false)
      })
    })
  })

  describe('Given email validation', () => {
    describe('When valid email is provided', () => {
      it('Then it should mark email as valid', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        act(() => {
          result.current.setEmail('user@example.com')
        })

        expect(result.current.isEmailValid).toBe(true)
      })
    })

    describe('When invalid email is provided', () => {
      it('Then it should mark email as invalid', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        act(() => {
          result.current.setEmail('invalid-email')
        })

        expect(result.current.isEmailValid).toBe(false)
      })
    })
  })

  describe('Given password validation', () => {
    describe('When valid password is provided', () => {
      it('Then it should meet all requirements', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        act(() => {
          result.current.setPassword('Test1234!')
        })

        expect(result.current.passwordValidation.isValid).toBe(true)
        expect(result.current.passwordValidation.minLength).toBe(true)
        expect(result.current.passwordValidation.hasCapital).toBe(true)
        expect(result.current.passwordValidation.hasNumber).toBe(true)
        expect(result.current.passwordValidation.hasSpecial).toBe(true)
      })
    })

    describe('When weak password is provided', () => {
      it('Then it should fail validation requirements', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        act(() => {
          result.current.setPassword('weak')
        })

        expect(result.current.passwordValidation.isValid).toBe(false)
      })
    })
  })

  describe('Given password confirmation', () => {
    describe('When passwords match', () => {
      it('Then it should mark passwords as matching', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        act(() => {
          result.current.setPassword('Test1234!')
          result.current.setConfirmPassword('Test1234!')
        })

        expect(result.current.isPasswordMatch).toBe(true)
      })
    })

    describe('When passwords do not match', () => {
      it('Then it should mark passwords as not matching', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        act(() => {
          result.current.setPassword('Test1234!')
          result.current.setConfirmPassword('Different!')
        })

        expect(result.current.isPasswordMatch).toBe(false)
      })
    })
  })

  describe('Given complete form validation', () => {
    describe('When all fields are valid', () => {
      it('Then it should mark form as valid', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        act(() => {
          result.current.setEmail('user@example.com')
          result.current.setPassword('Test1234!')
          result.current.setConfirmPassword('Test1234!')
        })

        expect(result.current.isFormValid).toBe(true)
      })
    })

    describe('When any field is invalid', () => {
      it('Then it should mark form as invalid', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        act(() => {
          result.current.setEmail('invalid-email')
          result.current.setPassword('Test1234!')
          result.current.setConfirmPassword('Test1234!')
        })

        expect(result.current.isFormValid).toBe(false)
      })
    })
  })

  describe('Given validateForm function', () => {
    describe('When form validation is called with invalid email', () => {
      it('Then it should return email error message', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        act(() => {
          result.current.setEmail('invalid-email')
          result.current.setPassword('Test1234!')
          result.current.setConfirmPassword('Test1234!')
        })

        expect(result.current.validateForm()).toBe('Please enter a valid email address')
      })
    })

    describe('When form validation is called with invalid password', () => {
      it('Then it should return password error message', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        act(() => {
          result.current.setEmail('user@example.com')
          result.current.setPassword('weak')
          result.current.setConfirmPassword('weak')
        })

        expect(result.current.validateForm()).toBe('Password does not meet requirements')
      })
    })

    describe('When form validation is called with mismatched passwords', () => {
      it('Then it should return password match error message', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        act(() => {
          result.current.setEmail('user@example.com')
          result.current.setPassword('Test1234!')
          result.current.setConfirmPassword('Different!')
        })

        expect(result.current.validateForm()).toBe('Passwords do not match')
      })
    })

    describe('When form validation is called with all valid fields', () => {
      it('Then it should return no error', () => {
        const { result } = renderHook(() => useRegistrationValidation())

        act(() => {
          result.current.setEmail('user@example.com')
          result.current.setPassword('Test1234!')
          result.current.setConfirmPassword('Test1234!')
        })

        expect(result.current.validateForm()).toBe(null)
      })
    })
  })
})