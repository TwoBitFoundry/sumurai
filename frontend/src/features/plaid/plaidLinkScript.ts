/**
 * Loads and initializes the Plaid Link browser SDK.
 */

import type {
  PlaidLinkOnExit,
  PlaidLinkOnSuccess,
  PlaidLinkOptionsWithLinkToken,
} from 'react-plaid-link';

export type PlaidLinkHandler = {
  open: () => void;
  destroy: () => void;
  exit?: (options?: unknown, callback?: () => void) => void;
};

export type PlaidLinkConfig = {
  token: string;
  onSuccess: PlaidLinkOnSuccess;
  onExit: PlaidLinkOnExit;
};

const PLAID_SCRIPT_ATTR = 'data-plaid-link';
const PLAID_SCRIPT_SRC = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

let plaidScriptPromise: Promise<void> | null = null;

export const resetPlaidScriptStateForTests = (): void => {
  plaidScriptPromise = null;
};

const findPlaidScript = (): HTMLScriptElement | null =>
  document.querySelector<HTMLScriptElement>(
    `script[${PLAID_SCRIPT_ATTR}], script[src="${PLAID_SCRIPT_SRC}"]`
  );

export const ensurePlaidScript = (): Promise<void> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Plaid Link can only be initialized in a browser environment'));
  }

  if (window.Plaid) {
    return Promise.resolve();
  }

  if (plaidScriptPromise) {
    return plaidScriptPromise;
  }

  plaidScriptPromise = new Promise<void>((resolve, reject) => {
    const resolveOnce = () => {
      plaidScriptPromise = null;
      resolve();
    };

    const rejectOnce = (error: Error) => {
      plaidScriptPromise = null;
      reject(error);
    };

    const existingScript = findPlaidScript();

    const completeLoad = (script: HTMLScriptElement) => {
      if (window.Plaid) {
        script.dataset.loaded = 'true';
        resolveOnce();
      } else {
        rejectOnce(new Error('Plaid Link SDK loaded but did not expose a global instance'));
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
        rejectOnce(new Error('Failed to load Plaid Link script'));
      };

      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = PLAID_SCRIPT_SRC;
    script.async = true;
    script.setAttribute(PLAID_SCRIPT_ATTR, 'true');

    const handleLoad = () => {
      script.removeEventListener('error', handleError);
      completeLoad(script);
    };

    const handleError = () => {
      script.removeEventListener('load', handleLoad);
      script.remove();
      rejectOnce(new Error('Failed to load Plaid Link script'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    document.head.appendChild(script);
  });

  return plaidScriptPromise;
};

export const createPlaidLinkHandler = async ({
  token,
  onSuccess,
  onExit,
}: PlaidLinkConfig): Promise<PlaidLinkHandler> => {
  await ensurePlaidScript();

  if (!window.Plaid) {
    throw new Error('Plaid Link SDK not available on window');
  }

  return window.Plaid.create({
    token,
    onSuccess,
    onExit,
  } as PlaidLinkOptionsWithLinkToken) as unknown as PlaidLinkHandler;
};

export function isPlaidScriptOrInitError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes('Failed to load Plaid Link script') ||
      err.message.includes('Plaid Link SDK loaded but did not expose') ||
      err.message.includes('Plaid Link SDK not available') ||
      err.message.includes('Plaid Link can only be initialized in a browser environment'))
  );
}
