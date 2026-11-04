import * as Primitive from '@radix-ui/react-tooltip';
import type { ReactElement } from 'react';
import { useTopLayer } from './topLayer';

/** shadcn's Tooltip, on keyboard focus too, for controls that show only an icon. On a phone those show their word. */
export function Tip({ label, children }: { label: string; children: ReactElement }) {
  const { ref, container } = useTopLayer<HTMLSpanElement>();
  return (
    <Primitive.Provider delayDuration={200}>
      <Primitive.Root>
        <Primitive.Trigger asChild>{children}</Primitive.Trigger>
        <span ref={ref} hidden />
        {container && (
          <Primitive.Portal container={container}>
            <Primitive.Content
              sideOffset={6}
              className="z-50 w-fit animate-fade rounded-control bg-navy px-3 py-1.5 text-xs text-white"
            >
              {label}
              <Primitive.Arrow className="fill-navy" />
            </Primitive.Content>
          </Primitive.Portal>
        )}
      </Primitive.Root>
    </Primitive.Provider>
  );
}
