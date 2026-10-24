import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';

const QUESTION = 'Tin chưa được lưu. Rời trang thì mất nội dung vừa nhập. Vẫn rời đi?';

/**
 * Asks before leaving a form with unsaved changes: closing the tab, or a link inside the app.
 * Returns `allowLeave`, to call right before navigating away after a successful save.
 */
export function useUnsavedGuard(dirty: boolean): () => void {
  const allowed = useRef(false);
  useEffect(() => {
    // Once the saved form is shown again, new edits are guarded again.
    if (!dirty) allowed.current = false;
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !allowed.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(QUESTION)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  return () => {
    allowed.current = true;
  };
}
