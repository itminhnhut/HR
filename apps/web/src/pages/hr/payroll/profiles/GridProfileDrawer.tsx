import { DEFAULT_COMPONENTS, DEFAULT_CONTRACT_TYPES } from '@careers/shared';
import { useMemo } from 'react';
import type { PayrollMonthDto } from '../../../../api';
import { useEmployees, useRegions } from '../../timesheet/queries';
import { ProfileDrawer, type DrawerContext } from './ProfileDrawer';
import { payrollMonthOf, profileRowsOf } from './profileModel';
import { useChecklist, useProfiles } from './profileQueries';

/** What the Hồ sơ lương drawer needs, the same on its own tab and over Bảng lương. */
export function drawerContextOf(args: {
  month: PayrollMonthDto | undefined;
  today: string;
  /** "YYYY-MM" of the pay month whose level to mark (`phan=muc`), or null. */
  levelsOf: string | null;
  regions: readonly { id: string; name: string }[] | undefined;
}): DrawerContext {
  const { month, today, levelsOf, regions } = args;
  return {
    catalogue: {
      components: month?.components.length ? month.components : DEFAULT_COMPONENTS,
      contractTypes: month?.contractTypes.length ? month.contractTypes : DEFAULT_CONTRACT_TYPES,
    },
    today,
    month: payrollMonthOf(today),
    levelsOf,
    regionName: (id) => regions?.find((r) => r.id === id)?.name ?? month?.regions.find((r) => r.id === id)?.name ?? id,
  };
}

/**
 * A person's Hồ sơ lương opened from a group A cell, over Bảng lương: the tab, the filters and the grid's scroll stay
 * under it, and a level saved here computes the grid again (spec 11.2, 11.5).
 */
export function GridProfileDrawer({
  employeeId,
  month,
  today,
  isLevels,
  onClose,
}: {
  employeeId: string;
  month: PayrollMonthDto;
  today: string;
  isLevels: boolean;
  onClose: () => void;
}) {
  const list = useProfiles();
  const checklist = useChecklist();
  const employees = useEmployees();
  const regions = useRegions();
  const row = useMemo(
    () =>
      list.data
        ? profileRowsOf(list.data, employees.data, month.lines, checklist.data).find((r) => r.employeeId === employeeId)
        : undefined,
    [list.data, employees.data, month.lines, checklist.data, employeeId],
  );
  const context = drawerContextOf({
    month,
    today,
    levelsOf: isLevels ? month.monthKey : null,
    regions: regions.data,
  });
  return <ProfileDrawer key={employeeId} employeeId={employeeId} row={row} context={context} onClose={onClose} />;
}
