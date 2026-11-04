import * as Primitive from '@radix-ui/react-alert-dialog';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { buttonClass } from '../../../ui/Button';
import { useTopLayer } from './topLayer';

export interface ConfirmOptions {
  title: string;
  description?: string;
  action: string;
  cancel?: string;
  isDanger?: boolean;
}

/**
 * shadcn's AlertDialog in place of window.confirm: `const [confirm, dialog] = useConfirm();`, render {dialog} once, and
 * `await confirm({...})` says whether HR agreed.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const answer = useRef<((agreed: boolean) => void) | null>(null);
  const { ref, container } = useTopLayer<HTMLSpanElement>();

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        answer.current = resolve;
        setOptions(next);
      }),
    [],
  );
  const close = (agreed: boolean) => {
    answer.current?.(agreed);
    answer.current = null;
    setOptions(null);
  };

  const dialog = (
    <>
      <span ref={ref} hidden />
      <Primitive.Root open={!!options} onOpenChange={(open) => !open && close(false)}>
        {container && options && (
          <Primitive.Portal container={container}>
            <Primitive.Overlay className="fixed inset-0 z-50 animate-fade bg-black/50" />
            <Primitive.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-line bg-white p-6 text-navy shadow-lg outline-none">
              <div className="flex flex-col gap-2 text-center sm:text-left">
                <Primitive.Title className="m-0 text-lg font-semibold leading-none text-navy">
                  {options.title}
                </Primitive.Title>
                {options.description ? (
                  <Primitive.Description className="m-0 text-sm text-slate">
                    {options.description}
                  </Primitive.Description>
                ) : (
                  <Primitive.Description className="sr-only">{options.title}</Primitive.Description>
                )}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Primitive.Cancel className={buttonClass('outline')}>{options.cancel ?? 'Huỷ'}</Primitive.Cancel>
                <Primitive.Action
                  onClick={() => close(true)}
                  className={buttonClass(options.isDanger ? 'danger' : 'primary')}
                >
                  {options.action}
                </Primitive.Action>
              </div>
            </Primitive.Content>
          </Primitive.Portal>
        )}
      </Primitive.Root>
    </>
  );
  return [confirm, dialog];
}
