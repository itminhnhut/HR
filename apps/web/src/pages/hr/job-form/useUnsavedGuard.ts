import { useEffect, useRef, type ReactNode } from 'react';
import { useBlocker } from 'react-router';
import { useConfirm } from '../shadcn/Confirm';

/**
 * Asks before leaving a form with unsaved changes: closing the tab, or a link inside the app.
 * Returns `allowLeave`, to call right before navigating away after a successful save, and the dialog to render.
 */
export function useUnsavedGuard(dirty: boolean): { allowLeave: () => void; guardDialog: ReactNode } {
  const allowed = useRef(false);
  const isAsking = useRef(false);
  const [confirm, guardDialog] = useConfirm();
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
    if (blocker.state !== 'blocked' || isAsking.current) return;
    isAsking.current = true;
    void confirm({
      title: 'Rời trang?',
      description: 'Tin chưa được lưu, nội dung vừa nhập sẽ mất.',
      action: 'Rời trang',
      cancel: 'Ở lại',
      isDanger: true,
    }).then((agreed) => {
      isAsking.current = false;
      if (agreed) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker, confirm]);

  return {
    allowLeave: () => {
      allowed.current = true;
    },
    guardDialog,
  };
}
