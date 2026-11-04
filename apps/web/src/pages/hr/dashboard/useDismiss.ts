import { useEffect, useRef } from 'react';

/** Closes on a press outside or Esc, and gives the focus back to the button on Esc. */
export function useDismiss(isOpen: boolean, close: () => void) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (e.target instanceof Node && !box.current?.contains(e.target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      box.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);
  return box;
}
