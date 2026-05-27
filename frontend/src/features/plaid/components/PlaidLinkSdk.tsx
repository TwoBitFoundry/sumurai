'use client';

import { type RefObject, useEffect, useImperativeHandle, useRef } from 'react';
import type { PlaidLinkOnExit, PlaidLinkOnSuccess } from 'react-plaid-link';
import {
  createPlaidLinkHandler,
  isPlaidScriptOrInitError,
  type PlaidLinkHandler,
} from '@/features/plaid/plaidLinkScript';

export type PlaidLinkSdkHandle = {
  open: () => void;
  getReady: () => boolean;
};

export type PlaidLinkSdkProps = {
  token: string | undefined;
  onSuccess: PlaidLinkOnSuccess;
  onExit: PlaidLinkOnExit;
  onReady?: () => void;
  onScriptLoadFailed: () => void;
};

export const PlaidLinkSdk = function PlaidLinkSdk({
  token,
  onSuccess,
  onExit,
  onReady,
  onScriptLoadFailed,
  ref,
}: PlaidLinkSdkProps & { ref?: RefObject<PlaidLinkSdkHandle | null> }) {
  const handlerRef = useRef<PlaidLinkHandler | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onExitRef = useRef(onExit);
  const onReadyRef = useRef(onReady);
  const onScriptLoadFailedRef = useRef(onScriptLoadFailed);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onExitRef.current = onExit;
  }, [onExit]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onScriptLoadFailedRef.current = onScriptLoadFailed;
  }, [onScriptLoadFailed]);

  useImperativeHandle(ref, () => ({
    open: () => {
      handlerRef.current?.open();
    },
    getReady: () => Boolean(handlerRef.current),
  }));

  useEffect(() => {
    if (!token) {
      handlerRef.current = null;
      return;
    }

    let isActive = true;
    let createdHandler: PlaidLinkHandler | null = null;

    const initialize = async () => {
      try {
        const nextHandler = await createPlaidLinkHandler({
          token,
          onSuccess: (...args) => onSuccessRef.current(...args),
          onExit: (...args) => onExitRef.current(...args),
        });
        createdHandler = nextHandler;
        if (isActive) {
          handlerRef.current = nextHandler;
          onReadyRef.current?.();
        } else {
          nextHandler.destroy();
        }
      } catch (err) {
        console.warn('Failed to initialize Plaid Link', err);
        if (isActive) {
          handlerRef.current = null;
        }
        if (isPlaidScriptOrInitError(err)) {
          onScriptLoadFailedRef.current();
        }
      }
    };

    void initialize();

    return () => {
      isActive = false;
      if (createdHandler) {
        try {
          createdHandler.exit?.({ force: true }, () => createdHandler?.destroy());
          if (!createdHandler.exit) {
            createdHandler.destroy();
          }
        } catch {
          createdHandler.destroy();
        }
      }
    };
  }, [token]);

  return null;
};
