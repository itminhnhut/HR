import { useIsFetching } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigation } from 'react-router';

/** Under this, a load finishes before the bar would show: no flash. */
const QUIET_MS = 150;

type Phase = 'idle' | 'busy' | 'done';

/** True while a page's code is loading (navigation) or a page waits for its first data. */
function useBusy(): boolean {
  const navigation = useNavigation();
  const firstLoads = useIsFetching({ predicate: (q) => q.state.status === 'pending' });
  return navigation.state !== 'idle' || firstLoads > 0;
}

function usePhase(busy: boolean): Phase {
  const [phase, setPhase] = useState<Phase>('idle');
  const startedAt = useRef(0);
  useEffect(() => {
    if (busy) {
      startedAt.current = Date.now();
      setPhase('busy');
      return;
    }
    // A quick load never showed the bar: just drop it. Otherwise fill it up, then fade it out.
    if (Date.now() - startedAt.current < QUIET_MS) {
      setPhase('idle');
      return;
    }
    setPhase((p) => (p === 'busy' ? 'done' : p));
    const t = setTimeout(() => setPhase('idle'), 450);
    return () => clearTimeout(t);
  }, [busy]);
  return phase;
}

/** A thin bar at the very top while the next page loads. Decorative: the pages announce loading themselves. */
export function RouteProgress() {
  const phase = usePhase(useBusy());
  if (phase === 'idle') return null;
  const done = phase === 'done';
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] transition-opacity delay-150 duration-300 ${done ? 'opacity-0' : 'opacity-100'}`}
      style={done ? undefined : { animation: `enter-fade 0.2s ease ${QUIET_MS}ms both` }}
    >
      <div
        className="h-full origin-left bg-linear-to-r from-focus to-silver shadow-[0_0_8px_rgb(74_120_194/0.6)]"
        style={
          done
            ? { transform: 'scaleX(1)', transition: 'transform 0.2s ease-out' }
            : { animation: 'progress-grow 8s cubic-bezier(0.1, 0.7, 0.2, 1) forwards' }
        }
      />
    </div>
  );
}
