'use client';

import { type RefObject, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  apiGateway,
  cleanupTellerConnectDom,
  ensureTellerScript,
  isTellerScriptOrInitError,
  type TellerConnectGateway,
  type TellerEnrollment,
  type TellerEnvironment,
} from '@/features/teller/tellerConnectScript';

export type TellerConnectSdkHandle = {
  open: () => void;
  getReady: () => boolean;
};

export type TellerEnrollmentConnectedPayload = {
  connectionId: string;
  institutionName: string;
};

export type TellerConnectSdkProps = {
  applicationId: string;
  environment?: TellerEnvironment;
  retryKey?: number;
  gateway?: TellerConnectGateway;
  onConnected?: (payload: TellerEnrollmentConnectedPayload) => Promise<void> | void;
  onExit?: () => Promise<void> | void;
  onEnrollmentError?: (error: unknown) => Promise<void> | void;
  onScriptLoadFailed?: () => void;
};

type TellerInstance = {
  open: () => void;
  destroy: () => void;
};

const TELLER_OPEN_TIMEOUT_MS = 8_000;

export const TellerConnectSdk = function TellerConnectSdk({
  applicationId,
  environment = 'development',
  retryKey = 0,
  gateway = apiGateway,
  onConnected,
  onExit,
  onEnrollmentError,
  onScriptLoadFailed,
  ref,
}: TellerConnectSdkProps & { ref?: RefObject<TellerConnectSdkHandle | null> }) {
  const instanceRef = useRef<TellerInstance | null>(null);
  const onConnectedRef = useRef(onConnected);
  const onExitRef = useRef(onExit);
  const onEnrollmentErrorRef = useRef(onEnrollmentError);
  const onScriptLoadFailedRef = useRef(onScriptLoadFailed);
  const openedRef = useRef(false);
  const initializedAfterOpenRef = useRef(false);
  const openTimeoutRef = useRef<number | null>(null);

  const clearOpenTimeout = useCallback(() => {
    if (openTimeoutRef.current !== null) {
      window.clearTimeout(openTimeoutRef.current);
      openTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    cleanupTellerConnectDom();

    return () => {
      clearOpenTimeout();
      cleanupTellerConnectDom();
    };
  }, [clearOpenTimeout]);

  useEffect(() => {
    onConnectedRef.current = onConnected;
  }, [onConnected]);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    onEnrollmentErrorRef.current = onEnrollmentError;
  }, [onEnrollmentError]);

  useEffect(() => {
    onScriptLoadFailedRef.current = onScriptLoadFailed;
  }, [onScriptLoadFailed]);

  useImperativeHandle(ref, () => ({
    open: () => {
      const inst = instanceRef.current;
      if (!inst) {
        return;
      }

      openedRef.current = true;
      initializedAfterOpenRef.current = false;
      clearOpenTimeout();
      openTimeoutRef.current = window.setTimeout(() => {
        if (openedRef.current && !initializedAfterOpenRef.current) {
          cleanupTellerConnectDom();
          openedRef.current = false;
          onEnrollmentErrorRef.current?.(new Error('Teller Connect did not finish loading'));
        }
      }, TELLER_OPEN_TIMEOUT_MS);
      inst.open();
    },
    getReady: () => Boolean(instanceRef.current),
  }));

  useEffect(() => {
    void retryKey;
    if (!applicationId) {
      instanceRef.current = null;
      return;
    }

    let isActive = true;
    let createdInstance: TellerInstance | null = null;

    const initialize = async () => {
      try {
        cleanupTellerConnectDom();
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
          products: ['balance', 'transactions'],
          selectAccount: 'multiple',
          onInit: () => {
            if (openedRef.current) {
              initializedAfterOpenRef.current = true;
              clearOpenTimeout();
            }
          },
          onSuccess: async (enrollment: TellerEnrollment) => {
            clearOpenTimeout();
            openedRef.current = false;
            try {
              const result = await gateway.storeEnrollment({
                access_token: enrollment.accessToken,
                enrollment_id: enrollment.enrollment.id,
                institution_name: enrollment.enrollment.institution.name,
              });
              await onConnectedRef.current?.({
                connectionId: result.connection_id,
                institutionName: result.institution_name,
              });
            } catch (err) {
              console.warn('Failed to persist Teller enrollment', err);
              await onEnrollmentErrorRef.current?.(err);
              throw err;
            }
          },
          onExit: () => {
            clearOpenTimeout();
            openedRef.current = false;
            cleanupTellerConnectDom();
            void onExitRef.current?.();
          },
          onFailure: (failure) => {
            clearOpenTimeout();
            openedRef.current = false;
            cleanupTellerConnectDom();
            void onEnrollmentErrorRef.current?.(
              new Error(failure.message || 'Teller Connect failed')
            );
          },
        });

        createdInstance = tellerInstance;
        instanceRef.current = tellerInstance;
      } catch (err) {
        console.warn('Failed to initialize Teller Connect', err);
        if (isActive) {
          instanceRef.current = null;
        }
        if (isTellerScriptOrInitError(err)) {
          onScriptLoadFailedRef.current?.();
        } else {
          await onEnrollmentErrorRef.current?.(err);
        }
      }
    };

    void initialize();

    return () => {
      isActive = false;
      clearOpenTimeout();
      if (createdInstance) {
        createdInstance.destroy();
      }
      cleanupTellerConnectDom();
    };
  }, [applicationId, clearOpenTimeout, environment, gateway, retryKey]);

  return null;
};
