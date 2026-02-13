import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClient } from '../services/ApiClient';

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
  onExit?: () => void;
  environment?: TellerEnvironment;
  selectAccount?: 'single' | 'multiple';
}

interface TellerEnrollment {
  accessToken: string;
  user: { id: string };
  enrollment: { id: string; institution: { name: string } };
}

interface TellerInstance {
  open: () => void;
  destroy: () => void;
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

let tellerScriptLoaded = false;
let tellerScriptPromise: Promise<void> | null = null;

const ensureTellerScript = (): Promise<void> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(
      new Error('Teller Connect can only be initialized in a browser environment')
    );
  }

  if (window.TellerConnect) {
    tellerScriptLoaded = true;
    return Promise.resolve();
  }

  if (tellerScriptLoaded) {
    return Promise.resolve();
  }

  if (tellerScriptPromise) {
    return tellerScriptPromise;
  }

  tellerScriptPromise = new Promise<void>((resolve, reject) => {
    const resolveOnce = () => {
      if (tellerScriptLoaded) {
        return;
      }
      tellerScriptLoaded = true;
      tellerScriptPromise = null;
      resolve();
    };

    const rejectOnce = (error: Error) => {
      tellerScriptPromise = null;
      reject(error);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[${TELLER_SCRIPT_ATTR}]`
    );

    const completeLoad = () => {
      if (window.TellerConnect) {
        resolveOnce();
      } else {
        rejectOnce(new Error('Teller Connect SDK loaded but did not expose a global instance'));
      }
    };

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        completeLoad();
        return;
      }

      const handleLoad = () => {
        existingScript.removeEventListener('error', handleError);
        existingScript.dataset.loaded = 'true';
        completeLoad();
      };

      const handleError = () => {
        existingScript.removeEventListener('load', handleLoad);
        rejectOnce(new Error('Failed to load Teller Connect script'));
      };

      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = TELLER_SCRIPT_SRC;
    script.async = true;
    script.setAttribute(TELLER_SCRIPT_ATTR, 'true');

    const handleLoad = () => {
      script.removeEventListener('error', handleError);
      script.dataset.loaded = 'true';
      completeLoad();
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

const apiGateway: TellerConnectGateway = {
  async storeEnrollment(payload) {
    return ApiClient.post<StoreEnrollmentResponse>('/providers/connect', {
      provider: 'teller',
      ...payload,
    });
  },
  async syncTransactions(connectionId) {
    await ApiClient.post('/providers/sync-transactions', {
      connection_id: connectionId,
    });
  },
};

export interface UseTellerConnectOptions {
  applicationId: string;
  environment?: TellerEnvironment;
  gateway?: TellerConnectGateway;
  onConnected?: () => Promise<void> | void;
  onExit?: () => Promise<void> | void;
  onError?: (error: unknown) => Promise<void> | void;
}

export interface UseTellerConnectResult {
  ready: boolean;
  open: () => void;
}

export function useTellerConnect(options: UseTellerConnectOptions): UseTellerConnectResult {
  const {
    applicationId,
    environment = 'development',
    gateway = apiGateway,
    onConnected,
    onExit,
    onError,
  } = options;
  const [instance, setInstance] = useState<TellerInstance | null>(null);
  const onConnectedRef = useRef<UseTellerConnectOptions['onConnected']>(onConnected);
  const onExitRef = useRef<UseTellerConnectOptions['onExit']>(onExit);
  const onErrorRef = useRef<UseTellerConnectOptions['onError']>(onError);

  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!applicationId) {
      setInstance(null);
      return;
    }

    let isActive = true;
    let createdInstance: TellerInstance | null = null;

    const initialize = async () => {
      try {
        await ensureTellerScript();
        if (!isActive) {
          return;
        }

        if (!window.TellerConnect) {
          throw new Error('TellerConnect script not available on window');
        }

        const tellerInstance = window.TellerConnect.setup({
          applicationId,
          environment,
          selectAccount: 'multiple',
          onSuccess: async (enrollment) => {
            try {
              const result = await gateway.storeEnrollment({
                access_token: enrollment.accessToken,
                enrollment_id: enrollment.enrollment.id,
                institution_name: enrollment.enrollment.institution.name,
              });
              await gateway.syncTransactions(result.connection_id);
              await onConnectedRef.current?.();
            } catch (err) {
              console.warn('Failed to persist Teller enrollment', err);
              await onErrorRef.current?.(err);
              throw err;
            }
          },
          onExit: () => {
            void onExitRef.current?.();
          },
        });

        createdInstance = tellerInstance;
        setInstance(tellerInstance);
      } catch (err) {
        console.warn('Failed to initialize Teller Connect', err);
        if (isActive) {
          setInstance(null);
        }
        await onErrorRef.current?.(err);
      }
    };

    void initialize();

    return () => {
      isActive = false;
      if (createdInstance) {
        createdInstance.destroy();
      }
    };
  }, [applicationId, environment, gateway]);

  const open = useCallback(() => {
    instance?.open();
  }, [instance]);

  return {
    ready: Boolean(instance),
    open,
  };
}
