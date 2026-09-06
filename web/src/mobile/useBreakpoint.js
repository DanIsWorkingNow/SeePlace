// useBreakpoint — one source of truth for "are we on a phone?"
//
// Matches Tailwind's default breakpoints. `isMobile` is the one most callers
// want: true below `md` (768 px), i.e. the layout switches to MobileShell.
//
// SSR-safe (returns desktop defaults when `window` is absent) and updates on
// resize / orientation change via matchMedia.
import { useEffect, useState } from 'react';

const QUERIES = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
};

function read() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return { sm: true, md: true, lg: true, xl: true, width: 1280 };
  }
  return {
    sm: window.matchMedia(QUERIES.sm).matches,
    md: window.matchMedia(QUERIES.md).matches,
    lg: window.matchMedia(QUERIES.lg).matches,
    xl: window.matchMedia(QUERIES.xl).matches,
    width: window.innerWidth,
  };
}

export function useBreakpoint() {
  const [bp, setBp] = useState(read);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mqls = Object.values(QUERIES).map((q) => window.matchMedia(q));
    const onChange = () => setBp(read());
    mqls.forEach((m) => m.addEventListener('change', onChange));
    window.addEventListener('orientationchange', onChange);
    return () => {
      mqls.forEach((m) => m.removeEventListener('change', onChange));
      window.removeEventListener('orientationchange', onChange);
    };
  }, []);

  return {
    ...bp,
    isMobile: !bp.md,
    isTablet: bp.md && !bp.lg,
    isDesktop: bp.lg,
  };
}

export default useBreakpoint;
