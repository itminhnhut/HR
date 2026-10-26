import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { useBlocker, type Blocker } from 'react-router';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/Dialog';

/**
 * Asks before leaving the editor with unsaved changes: the browser's own question when the tab closes, the
 * site dialog (LeaveDialog) for a link in the app. `allowedPath` lets one address through: /moi → /:id
 * after the first save is not leaving. `allowAll` is for leaving on purpose (after deleting the post).
 */
export function useLeaveGuard(dirty: boolean, allowedPath: RefObject<string | null>) {
  const all = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!dirty || all.current || currentLocation.pathname === nextLocation.pathname) return false;
    return nextLocation.pathname !== allowedPath.current;
  });

  const allowAll = useCallback(() => {
    all.current = true;
  }, []);
  return { allowAll, blocker };
}

/** "Rời trang?" in the site dialog: stay (default) or leave without the unsaved edits. */
export function LeaveDialog({ blocker }: { blocker: Blocker }) {
  const open = blocker.state === 'blocked';
  const stay = () => blocker.reset?.();
  return (
    <Dialog open={open} onClose={stay} label="Rời trang khi chưa lưu?">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <h2 className="m-0 font-serif text-[24px] font-medium">Rời trang khi chưa lưu?</h2>
        <p className="m-0 text-[15px] leading-relaxed text-body">
          Bài có thay đổi chưa lưu. Rời trang thì mất phần vừa sửa.
        </p>
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="outline" onClick={() => blocker.proceed?.()}>
            Rời trang
          </Button>
          <Button variant="dark" onClick={stay}>
            Ở lại sửa tiếp
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
