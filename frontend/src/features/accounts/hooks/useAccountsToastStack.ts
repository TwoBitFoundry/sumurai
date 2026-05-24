import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ToastStackPinnedToast,
  ToastStackTransientItem,
} from '@/components/toastStack/ToastStack';
import {
  buildAutoCategorizationProgressTitle,
  buildAutoCategorizationTerminalMessage,
} from '@/features/accounts/utils/autoCategorizationToastMessages';
import { type AutoCategorizationJobState, isAutoCategorizationJobActive } from '@/types/api';

let transientToastCounter = 0;

function nextTransientToastId(): string {
  transientToastCounter += 1;
  return `toast-${transientToastCounter}`;
}

export function useAccountsToastStack(job: AutoCategorizationJobState | null) {
  const [transients, setTransients] = useState<ToastStackTransientItem[]>([]);
  const [dismissedProgressJobId, setDismissedProgressJobId] = useState<string | null>(null);
  const [terminalToast, setTerminalToast] = useState<ToastStackPinnedToast | null>(null);
  const wasActiveRef = useRef(false);

  const pushToast = useCallback((message: string, type?: 'error' | 'success') => {
    const id = nextTransientToastId();
    setTransients((current) => [...current, { id, message, type }]);
    return id;
  }, []);

  const dismissTransient = useCallback((id: string) => {
    setTransients((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const dismissPinned = useCallback(() => {
    if (terminalToast) {
      setTerminalToast(null);
      return;
    }
    if (job && isAutoCategorizationJobActive(job.status)) {
      setDismissedProgressJobId(job.job_id);
    }
  }, [job, terminalToast]);

  useEffect(() => {
    if (!job) {
      wasActiveRef.current = false;
      return;
    }

    const active = isAutoCategorizationJobActive(job.status);

    if (active && dismissedProgressJobId && dismissedProgressJobId !== job.job_id) {
      setDismissedProgressJobId(null);
    }

    if (wasActiveRef.current && !active) {
      if (job.job_id !== dismissedProgressJobId) {
        setTerminalToast({
          message: buildAutoCategorizationTerminalMessage(job),
          autoDismiss: true,
        });
      }
    }

    if (active) {
      setTerminalToast(null);
    }

    wasActiveRef.current = active;
  }, [job, dismissedProgressJobId]);

  const pinnedToast = useMemo((): ToastStackPinnedToast | null => {
    if (terminalToast) {
      return terminalToast;
    }
    if (!job || !isAutoCategorizationJobActive(job.status)) {
      return null;
    }
    if (job.job_id === dismissedProgressJobId) {
      return null;
    }
    return {
      message: buildAutoCategorizationProgressTitle(job.status),
      progress: {
        processed: job.processed,
        total: job.total,
      },
      autoDismiss: false,
    };
  }, [job, dismissedProgressJobId, terminalToast]);

  return {
    transients,
    pinnedToast,
    pushToast,
    dismissTransient,
    dismissPinned,
  };
}
