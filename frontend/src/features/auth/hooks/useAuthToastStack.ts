import { useCallback, useState } from 'react';
import type { ToastStackTransientItem } from '@/components/toastStack/ToastStack';

let transientToastCounter = 0;

function nextTransientToastId(): string {
  transientToastCounter += 1;
  return `auth-toast-${transientToastCounter}`;
}

export function useAuthToastStack() {
  const [transients, setTransients] = useState<ToastStackTransientItem[]>([]);

  const pushToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    const id = nextTransientToastId();
    setTransients((current) => [...current, { id, message, type }]);
    return id;
  }, []);

  const dismissTransient = useCallback((id: string) => {
    setTransients((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return {
    transients,
    pushToast,
    dismissTransient,
  };
}
