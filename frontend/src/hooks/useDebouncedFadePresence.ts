import { useCallback, useEffect, useRef, useState } from 'react';

export type DebouncedFadePresenceOptions = {
  showDelayMs?: number;
  hideDelayMs?: number;
  fadeDurationMs?: number;
};

export function useDebouncedFadePresence<T>(
  value: T | null | undefined,
  { showDelayMs = 75, hideDelayMs = 100, fadeDurationMs = 200 }: DebouncedFadePresenceOptions = {}
) {
  const [content, setContent] = useState<T | null>(null);
  const [visible, setVisible] = useState(false);
  const isShowingRef = useRef(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    for (const timerRef of [showTimerRef, hideTimerRef, unmountTimerRef]) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    clearTimers();

    if (value != null) {
      setContent(value);

      if (isShowingRef.current) {
        setVisible(true);
        return;
      }

      showTimerRef.current = setTimeout(() => {
        isShowingRef.current = true;
        setVisible(true);
        showTimerRef.current = null;
      }, showDelayMs);

      return () => {
        if (showTimerRef.current) {
          clearTimeout(showTimerRef.current);
          showTimerRef.current = null;
        }
      };
    }

    hideTimerRef.current = setTimeout(() => {
      isShowingRef.current = false;
      setVisible(false);
      hideTimerRef.current = null;

      unmountTimerRef.current = setTimeout(() => {
        setContent(null);
        unmountTimerRef.current = null;
      }, fadeDurationMs);
    }, hideDelayMs);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (unmountTimerRef.current) {
        clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
    };
  }, [value, showDelayMs, hideDelayMs, fadeDurationMs, clearTimers]);

  return { content, visible, fadeDurationMs };
}
