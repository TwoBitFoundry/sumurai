import { useEffect, useState } from 'react';

export type ViewportBreakpoint = 'mobile' | 'tablet' | 'desktop';

function getViewportBreakpoint(): ViewportBreakpoint {
  if (typeof window === 'undefined') {
    return 'desktop';
  }

  if (window.innerWidth >= 1024) {
    return 'desktop';
  }

  if (window.innerWidth >= 768) {
    return 'tablet';
  }

  return 'mobile';
}

export function useViewportBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<ViewportBreakpoint>(getViewportBreakpoint);

  useEffect(() => {
    const updateBreakpoint = () => {
      setBreakpoint(getViewportBreakpoint());
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    window.addEventListener('orientationchange', updateBreakpoint);

    return () => {
      window.removeEventListener('resize', updateBreakpoint);
      window.removeEventListener('orientationchange', updateBreakpoint);
    };
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
  };
}

export default useViewportBreakpoint;
