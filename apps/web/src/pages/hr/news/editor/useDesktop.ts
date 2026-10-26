import { useEffect, useState } from 'react';

const QUERY = '(min-width: 1024px) and (pointer: fine)';

/** A wide screen with a mouse: drag handles and the floating toolbar are only offered there. */
export function useDesktopPointer(): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return;
    const onChange = () => setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return matches;
}
