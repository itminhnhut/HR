import type { ApplicationRowDto, ApplicationStatus } from '@careers/shared';
import { useEffect, useMemo, useState } from 'react';

export type TabKey = ApplicationStatus | 'all';

const NOTHING_VISITED: ReadonlySet<string> = new Set();

/** Who HR opened since arriving on this tab. */
function useVisited(selectedId: string | null, tab: TabKey): ReadonlySet<string> {
  const [visited, setVisited] = useState<{ tab: TabKey; ids: ReadonlySet<string> }>({ tab, ids: NOTHING_VISITED });
  useEffect(() => {
    if (!selectedId) return;
    setVisited((prev) => {
      const ids = prev.tab === tab ? prev.ids : NOTHING_VISITED;
      return prev.tab === tab && ids.has(selectedId) ? prev : { tab, ids: new Set([...ids, selectedId]) };
    });
  }, [selectedId, tab]);
  return visited.tab === tab ? visited.ids : NOTHING_VISITED;
}

/**
 * The rows of the list and the position of the open one. Opening a "Mới" application makes it "Đã xem", so anyone
 * HR opened stays in the tab until they leave it: "2/8" stays true and "Hồ sơ trước" can go back to them.
 */
export function useApplicantQueue(
  applications: ApplicationRowDto[] | undefined,
  tab: TabKey,
  selectedId: string | null,
  byMatch: boolean,
) {
  const visited = useVisited(selectedId, tab);
  const rows = useMemo(() => {
    const list = (applications ?? []).filter(
      (a) => tab === 'all' || a.status === tab || a.id === selectedId || visited.has(a.id),
    );
    // Best match first; applications not scored yet go last, newest first among them.
    return byMatch ? [...list].sort((a, b) => (b.matchPercent ?? -1) - (a.matchPercent ?? -1)) : list;
  }, [applications, tab, byMatch, selectedId, visited]);
  const at = rows.findIndex((r) => r.id === selectedId);
  return {
    rows,
    position: at >= 0 ? at + 1 : null,
    prevId: at > 0 ? rows[at - 1]?.id : undefined,
    nextId: at >= 0 ? rows[at + 1]?.id : rows[0]?.id,
  };
}
