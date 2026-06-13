import { useCallback, useState } from 'react';
import {
  getSessionCollapsibleExpanded,
  hasSessionCollapsibleExpanded,
  setSessionCollapsibleExpanded,
} from '@/utils/sessionPreferences';

export function useSessionCollapsible(sectionId: string, defaultExpanded = false) {
  const [expanded, setExpanded] = useState(() =>
    hasSessionCollapsibleExpanded(sectionId)
      ? getSessionCollapsibleExpanded(sectionId)
      : defaultExpanded
  );

  const setExpandedValue = useCallback(
    (next: boolean) => {
      setExpanded(next);
      setSessionCollapsibleExpanded(sectionId, next);
    },
    [sectionId]
  );

  const toggleExpanded = useCallback(() => {
    setExpanded((value) => {
      const next = !value;
      setSessionCollapsibleExpanded(sectionId, next);
      return next;
    });
  }, [sectionId]);

  return { expanded, toggleExpanded, setExpanded: setExpandedValue };
}
