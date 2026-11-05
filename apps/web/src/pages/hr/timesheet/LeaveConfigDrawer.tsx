import type { AbsenceKindDto } from '@careers/shared';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Settings2, Tags, UserCheck, type LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../vendor/shadcn-grid/components/ui/dialog';
import { KindsPanel } from './AbsenceKinds';
import { ApproversPanel, useApprovers } from './ApproverField';

type Panel = 'kinds' | 'approvers';

function PanelTab({ icon: Icon, label, count, isOn, onPick }: { icon: LucideIcon; label: string; count: number; isOn: boolean; onPick: () => void }) {
  return (
    <button type="button" role="tab" aria-selected={isOn} onClick={onPick} className={`-mb-px inline-flex h-10 flex-1 items-center justify-center gap-2 border-b-2 text-sm font-medium whitespace-nowrap ${isOn ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
      <Icon className="size-4" />
      {label}
      <span className="rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-700 tabular-nums">{count}</span>
    </button>
  );
}

/** What is set once and rarely touched: it opens over the page where HR enters people, and leaves that page clear. */
export function LeaveConfigDrawer({ open, kinds, onClose }: { open: boolean; kinds: readonly AbsenceKindDto[]; onClose: () => void }) {
  const [panel, setPanel] = useState<Panel>('kinds');
  const approvers = useApprovers();
  // Focus starts on the title: on a tab it would draw a box, in the first field it would raise a phone's keyboard.
  const title = useRef<HTMLHeadingElement>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent initialFocus={title} className="top-0! right-0! left-auto! flex h-dvh max-h-dvh! w-full max-w-md! translate-x-0! translate-y-0! flex-col gap-0 rounded-none! rounded-l-xl! p-0 max-sm:rounded-none!">
        <DialogHeader className="m-0! border-b px-5! py-4! pr-14!">
          <DialogTitle ref={title} tabIndex={-1} className="flex items-center gap-2 outline-none"><Settings2 className="size-5 text-blue-600" />Cấu hình nghỉ, đi muộn</DialogTitle>
          <DialogPrimitive.Description className="sr-only">Lý do nghỉ và danh sách người duyệt</DialogPrimitive.Description>
        </DialogHeader>
        <div role="tablist" aria-label="Mục cấu hình" className="flex border-b px-3">
          <PanelTab icon={Tags} label="Lý do" count={kinds.length} isOn={panel === 'kinds'} onPick={() => setPanel('kinds')} />
          <PanelTab icon={UserCheck} label="Người duyệt" count={approvers.data?.length ?? 0} isOn={panel === 'approvers'} onPick={() => setPanel('approvers')} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {panel === 'kinds' ? <KindsPanel kinds={kinds} /> : <ApproversPanel />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
