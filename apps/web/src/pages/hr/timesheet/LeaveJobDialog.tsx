import type { EmployeeDto, EmployeeInput } from '@careers/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserX } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../../api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../vendor/shadcn-grid/components/ui/dialog';
import { errorMessage } from '../parts';
import { DateField } from './DateField';

export const inputOf = (p: EmployeeDto): EmployeeInput => ({
  code: p.code,
  fullName: p.fullName,
  department: p.department,
  title: p.title,
  regionId: p.regionId,
  employment: p.employment,
  joinedOn: p.joinedOn,
  officialOn: p.officialOn,
  leftOn: p.leftOn,
  openingLeave: p.openingLeave,
});

/** A person's last day: the sheet greys out after it, and the review says what leave is still owed. */
export function LeaveJobDialog({ person, onClose, onSaved }: { person: EmployeeDto; onClose: () => void; onSaved: (saved: EmployeeDto) => void }) {
  const qc = useQueryClient();
  const [leftOn, setLeftOn] = useState(person.leftOn ?? '');
  const save = useMutation({
    mutationFn: () => api.hrUpdateEmployee(person.id, { ...inputOf(person), leftOn: leftOn || null }),
    onSuccess: (saved) => {
      void qc.invalidateQueries({ queryKey: ['hr', 'employees'] });
      void qc.invalidateQueries({ queryKey: ['hr', 'timesheet'] });
      onSaved(saved);
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><UserX className="size-5 text-orange-600" />Cho nghỉ việc: {person.fullName}</DialogTitle></DialogHeader>
        <DateField label="Ngày làm việc cuối" value={leftOn} onChange={setLeftOn} />
        <p className="m-0 text-xs text-slate-500">Sau ngày này bảng công tự xám, không tính công. Rà soát sẽ nhắc phép còn lại.</p>
        {save.isError && <p role="alert" className="m-0 text-sm text-red-600">{errorMessage(save.error)}</p>}
        <DialogFooter>
          <button type="button" onClick={onClose} className="ts-field rounded-md border bg-white px-4 text-sm font-medium hover:bg-slate-50">Huỷ</button>
          <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="ts-field inline-flex items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-50">Lưu</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
