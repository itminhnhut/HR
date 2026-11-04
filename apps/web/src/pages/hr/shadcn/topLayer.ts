import { useCallback, useState } from 'react';

/**
 * Where a floating part must render. A native <dialog> sits in the browser's top layer, so anything portalled to the
 * body would stay behind it; inside a popover, it must stay inside so a press on it does not count as outside.
 */
export function useTopLayer<T extends Element>() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const ref = useCallback((el: T | null) => {
    setContainer(el ? (el.closest<HTMLElement>('dialog,[role="dialog"],[data-portal-root]') ?? document.body) : null);
  }, []);
  return { ref, container };
}
