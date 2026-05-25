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
  onReady?: () => void;
  onConnected?: (payload: TellerEnrollmentConnectedPayload) => Promise<void> | void;
  onExit?: () => Promise<void> | void;
  onEnrollmentError?: (error: unknown) => Promise<void> | void;
  onScriptLoadFailed?: () => void;
};

type TellerInstance = {
  open: () => void;
  destroy: () => void;
};

export const TellerConnectSdk = function TellerConnectSdk({
  applicationId,
  environment = 'development',
  retryKey = 0,
  gateway = apiGateway,
  onReady,
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
  const onReadyRef = useRef(onReady);
  const onScriptLoadFailedRef = useRef(onScriptLoadFailed);
  const openedRef = useRef(false);

  useEffect(() => {
    cleanupTellerConnectDom();

    return () => {
      cleanupTellerConnectDom();
    };
  }, []);

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
    onReadyRef.current = onReady;
  }, [onReady]);

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
          onSuccess: async (enrollment: TellerEnrollment) => {
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
            openedRef.current = false;
            cleanupTellerConnectDom();
            void onExitRef.current?.();
          },
          onFailure: (failure) => {
            openedRef.current = false;
            cleanupTellerConnectDom();
            void onEnrollmentErrorRef.current?.(
              new Error(failure.message || 'Teller Connect failed')
            );
          },
        });

        createdInstance = tellerInstance;
        instanceRef.current = tellerInstance;
        onReadyRef.current?.();
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
      if (createdInstance) {
        createdInstance.destroy();
      }
      cleanupTellerConnectDom();
    };
  }, [applicationId, environment, gateway, retryKey]);

  return null;
};
