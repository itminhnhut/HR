import { useEffect, useRef } from 'react';

const isTypingIn = (target: EventTarget | null) =>
  target instanceof Element && target.matches('input, textarea, select, [contenteditable]');

/** Something on top of the page has the keys: a dialog (mail, add a profile, sources) or an open menu. */
const isCovered = () => document.querySelector('dialog[open], [role="menu"]') !== null;

function isForPage(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.repeat || e.isComposing) return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  return !isTypingIn(e.target) && !isCovered();
}

/**
 * J = next application, K = previous, for going through candidates one after another. Keys pressed inside the
 * CV viewer stay with the viewer: a browser does not pass them to the page.
 */
export function useQueueShortcuts({
  isEnabled,
  onPrev,
  onNext,
}: {
  isEnabled: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const actions = useRef({ onPrev, onNext });
  actions.current = { onPrev, onNext };
  useEffect(() => {
    if (!isEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isForPage(e)) return;
      const key = e.key.toLowerCase();
      if (key !== 'j' && key !== 'k') return;
      e.preventDefault();
      (key === 'j' ? actions.current.onNext : actions.current.onPrev)?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isEnabled]);
}
