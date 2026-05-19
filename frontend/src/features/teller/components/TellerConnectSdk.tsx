'use client';

import { type RefObject, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  apiGateway,
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

export type TellerConnectSdkProps = {
  applicationId: string;
  environment?: TellerEnvironment;
  retryKey?: number;
  gateway?: TellerConnectGateway;
  onConnected?: () => Promise<void> | void;
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
  onConnected,
  onExit,
  onEnrollmentError,
  onScriptLoadFailed,
  ref,
}: TellerConnectSdkProps & { ref?: RefObject<TellerConnectSdkHandle | null> }) {
  const [instance, setInstance] = useState<TellerInstance | null>(null);
  const onConnectedRef = useRef(onConnected);
  const onExitRef = useRef(onExit);
  const onEnrollmentErrorRef = useRef(onEnrollmentError);
  const onScriptLoadFailedRef = useRef(onScriptLoadFailed);

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

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        instance?.open();
      },
      getReady: () => Boolean(instance),
    }),
    [instance]
  );

  useEffect(() => {
    void retryKey;
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
          onSuccess: async (enrollment: TellerEnrollment) => {
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
              await onEnrollmentErrorRef.current?.(err);
              throw err;
            }
          },
          onExit: () => {
            void onExitRef.current?.();
          },
        });

        createdInstance = tellerInstance;
        flushSync(() => {
          setInstance(tellerInstance);
        });
      } catch (err) {
        console.warn('Failed to initialize Teller Connect', err);
        if (isActive) {
          setInstance(null);
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
    };
  }, [applicationId, environment, gateway, retryKey]);

  return null;
};
