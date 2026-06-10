import { useCallback, useState } from 'react';
import {
  getSessionCollapsibleExpanded,
  setSessionCollapsibleExpanded,
} from '@/utils/sessionPreferences';

export function useSessionCollapsible(sectionId: string) {
  const [expanded, setExpanded] = useState(() => getSessionCollapsibleExpanded(sectionId));

  const toggleExpanded = useCallback(() => {
    setExpanded((value) => {
      const next = !value;
      setSessionCollapsibleExpanded(sectionId, next);
      return next;
    });
  }, [sectionId]);

  return { expanded, toggleExpanded };
}
