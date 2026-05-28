/**
 * Loads Teller Connect and persists enrollments through the API.
 */

import { ApiClient } from '@/services/ApiClient';
import { buildSyncTransactionsRequest } from '@/utils/syncTransactionsRequest';

export type TellerEnvironment = 'sandbox' | 'development' | 'production';

declare global {
  interface Window {
    TellerConnect?: {
      setup: (config: TellerConnectConfig) => TellerInstance;
    };
  }
}

interface TellerConnectConfig {
  applicationId: string;
  onSuccess: (enrollment: TellerEnrollment) => Promise<void> | void;
  onInit?: () => void;
  onExit?: () => void;
  onFailure?: (failure: TellerFailure) => void;
  environment?: TellerEnvironment;
  selectAccount?: 'single' | 'multiple';
  products?: TellerProduct[];
}

export interface TellerEnrollment {
  accessToken: string;
  user: { id: string };
  enrollment: { id: string; institution: { name: string } };
}

interface TellerInstance {
  open: () => void;
  destroy: () => void;
}

type TellerProduct = 'verify' | 'verify.instant' | 'balance' | 'transactions' | 'identity';

interface TellerFailure {
  type?: string;
  code?: string;
  message?: string;
}

interface StoreEnrollmentRequest {
  access_token: string;
  enrollment_id: string;
  institution_name: string;
}

interface StoreEnrollmentResponse {
  connection_id: string;
  institution_name: string;
}

const TELLER_SCRIPT_ATTR = 'data-teller-connect';
const TELLER_SCRIPT_SRC = 'https://cdn.teller.io/connect/connect.js';

let tellerScriptPromise: Promise<void> | null = null;

export const resetTellerScriptStateForTests = (): void => {
  tellerScriptPromise = null;
};

export const cleanupTellerConnectDom = (): void => {
  if (typeof document === 'undefined') {
    return;
  }

  document
    .querySelectorAll<HTMLIFrameElement>('#teller-connect-window, iframe[src*="teller.io/connect"]')
    .forEach((iframe) => {
      const parent = iframe.parentElement;
      iframe.remove();
      if (
        parent &&
        parent !== document.body &&
        parent.children.length === 0 &&
        parent.textContent?.trim().length === 0
      ) {
        parent.remove();
      }
    });

  if (document.body.style.overflow === 'hidden') {
    document.body.style.overflow = '';
  }

  delete document.body.dataset.providerSdkInset;
};

const findTellerScript = (): HTMLScriptElement | null =>
  document.querySelector<HTMLScriptElement>(`script[${TELLER_SCRIPT_ATTR}]`);

export const ensureTellerScript = (): Promise<void> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(
      new Error('Teller Connect can only be initialized in a browser environment')
    );
  }

  if (window.TellerConnect) {
    return Promise.resolve();
  }

  if (tellerScriptPromise) {
    return tellerScriptPromise;
  }

  tellerScriptPromise = new Promise<void>((resolve, reject) => {
    const resolveOnce = () => {
      tellerScriptPromise = null;
      resolve();
    };

    const rejectOnce = (error: Error) => {
      tellerScriptPromise = null;
      reject(error);
    };

    const existingScript = findTellerScript();

    const completeLoad = (script: HTMLScriptElement) => {
      if (window.TellerConnect) {
        script.dataset.loaded = 'true';
        resolveOnce();
      } else {
        rejectOnce(new Error('Teller Connect SDK loaded but did not expose a global instance'));
      }
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        completeLoad(existingScript);
        return;
      }

      const handleLoad = () => {
        existingScript.removeEventListener('error', handleError);
        completeLoad(existingScript);
      };

      const handleError = () => {
        existingScript.removeEventListener('load', handleLoad);
        existingScript.remove();
        rejectOnce(new Error('Failed to load Teller Connect script'));
      };

      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = TELLER_SCRIPT_SRC;
    script.async = false;
    script.setAttribute(TELLER_SCRIPT_ATTR, 'true');

    const handleLoad = () => {
      script.removeEventListener('error', handleError);
      completeLoad(script);
    };

    const handleError = () => {
      script.removeEventListener('load', handleLoad);
      script.remove();
      rejectOnce(new Error('Failed to load Teller Connect script'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    document.head.appendChild(script);
  });

  return tellerScriptPromise;
};

export interface TellerConnectGateway {
  storeEnrollment: (payload: StoreEnrollmentRequest) => Promise<StoreEnrollmentResponse>;
  syncTransactions: (connectionId: string) => Promise<void>;
}

export const apiGateway: TellerConnectGateway = {
  async storeEnrollment(payload) {
    return ApiClient.post<StoreEnrollmentResponse>('/providers/connect', {
      provider: 'teller',
      ...payload,
    });
  },
  async syncTransactions(connectionId) {
    await ApiClient.post(
      '/providers/sync-transactions',
      buildSyncTransactionsRequest(connectionId)
    );
  },
};

export function isTellerScriptOrInitError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes('Failed to load Teller Connect script') ||
      err.message.includes('TellerConnect script not available') ||
      err.message.includes('Teller Connect SDK loaded but did not expose') ||
      err.message.includes('Teller Connect can only be initialized in a browser environment'))
  );
}
