import type { EmployeeDto, TimesheetDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { enteredOf, NOVEMBER_SHEET, OCTOBER_SHEET, type GoldenPerson } from '../../../../packages/shared/test-fixtures/timesheet-golden.js';
import { createFlow, rowOf, totalsOf, type Flow } from '../test/timesheet-flow.js';

/** HR's two real sheets, typed into the application by the way HR would, and read back. docs/test-cases-cham-cong.md. */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

function tableOf(dto: TimesheetDto, sheet: readonly GoldenPerson[]) {
  return Object.fromEntries(
    sheet.map((person) => {
      const { leaveOverdrawn: _overdrawn, paidBeforeAdjustment: _before, maternity: _m, sick: _s, leavePendingClosing: _p, leaveCredited: _c, unpaidCounted: _u, sickCounted: _k, ...totals } = totalsOf(dto, person.id);
      return [person.id, totals];
    }),
  );
}
const expectedOf = (sheet: readonly GoldenPerson[]) => Object.fromEntries(sheet.map((p) => [p.id, p.expected]));

/** Who the workbook lists in October, with what HR types: the machine does the rest. */
async function typeOctober(): Promise<Map<string, EmployeeDto>> {
  await flow.at('2026-10-26');
  const people = new Map<string, EmployeeDto>();
  // HR's sheets count leave their own way; "Như Excel cũ" is what reproduces them.
  const october = await flow.call<TimesheetDto>('PUT', `/${(await flow.period(2026, 10)).periodId}/leave-mode`, { mode: 'excel' });
  for (const person of OCTOBER_SHEET) {
    const added = await flow.addPerson({
      code: person.id,
      fullName: `Người ${person.id}`,
      regionId: person.region === 'HCM' ? flow.hcm.id : flow.hn.id,
      employment: person.employment,
      joinedOn: person.joinedOn ?? null,
      leftOn: person.leftOn ?? null,
      openingLeave: person.expected.leaveOpening,
    });
    people.set(person.id, added);
    await flow.enter(october, added.id, enteredOf(person.grid, october.from));
    if (person.adjustment) {
      await flow.call('POST', `/${october.periodId}/adjustments`, { employeeId: added.id, amount: person.adjustment, reason: 'Trừ công cố định', isRecurring: true }, 200);
    }
  }
  return people;
}

/** What HR does between the two sheets, then what HR types into November up to 05/11. */
async function typeNovember(people: Map<string, EmployeeDto>): Promise<TimesheetDto> {
  await flow.close(2026, 10);
  await flow.at('2026-11-05');
  const promoted = people.get('L');
  if (!promoted) throw new Error('Person L is missing');
  await flow.updatePerson(promoted, { employment: 'probation', officialOn: '2026-10-26' });
  const newcomer = NOVEMBER_SHEET.find((p) => p.id === 'N');
  if (!newcomer) throw new Error('Person N is missing');
  people.set('N', await flow.addPerson({ code: 'N', fullName: 'Người N', employment: 'probation', joinedOn: newcomer.joinedOn ?? null }));
  const november = await flow.period(2026, 11);
  for (const person of NOVEMBER_SHEET) {
    const id = people.get(person.id)?.id;
    if (!id) throw new Error(`Person ${person.id} is missing`);
    const entered = enteredOf(person.grid, november.from);
    if (Object.keys(entered).length > 0) await flow.enter(november, id, entered);
  }
  return flow.period(2026, 11);
}

describe('"Tháng 10.26" typed in, then read back', () => {
  it('TC-BT-05: should give all 12 people every total of the sheet', async () => {
    // Arrange
    await typeOctober();

    // Act
    const dto = await flow.period(2026, 10);

    // Assert
    expect(tableOf(dto, OCTOBER_SHEET)).toEqual(expectedOf(OCTOBER_SHEET));
  });

  it('TC-BT-06: should hold what HR typed and nothing else: 36 cells', async () => {
    // Arrange
    await typeOctober();

    // Act
    const dto = await flow.period(2026, 10);

    // Assert
    expect(dto.rows.flatMap((r) => Object.keys(r.cells))).toHaveLength(36);
  });

  it('TC-BT-07: should show the same totals after closing', async () => {
    // Arrange
    await typeOctober();

    // Act
    const dto = await flow.close(2026, 10);

    // Assert
    expect(dto.status).toBe('closed');
    expect(tableOf(dto, OCTOBER_SHEET)).toEqual(expectedOf(OCTOBER_SHEET));
  });
});

describe('from "Tháng 10.26" into "Tháng 11.26"', () => {
  it('TC-BT-08: should start November from October and reach every total of the sheet on 05/11', async () => {
    // Arrange
    const people = await typeOctober();

    // Act
    const november = await typeNovember(people);

    // Assert
    expect(november.today).toBe('2026-11-05');
    expect(tableOf(november, NOVEMBER_SHEET)).toEqual(expectedOf(NOVEMBER_SHEET));
  });

  it('TC-NV-03: should drop the two people who left in October, and only them', async () => {
    // Arrange
    const people = await typeOctober();

    // Act
    const november = await typeNovember(people);

    // Assert
    expect(november.rows.map((r) => r.code).sort()).toEqual(NOVEMBER_SHEET.map((p) => p.id).sort());
  });

  it('TC-TV-01: should make L official in November and keep L on probation in the closed October', async () => {
    // Arrange
    const people = await typeOctober();

    // Act
    const november = await typeNovember(people);
    const october = await flow.period(2026, 10);

    // Assert
    expect(rowOf(october, 'L').employment).toBe('probation');
    expect(rowOf(november, 'L').employment).toBe('official');
  });

  it('TC-DC-08: should carry the half day off G into November, as the comment in both sheets says', async () => {
    // Arrange
    const people = await typeOctober();

    // Act
    const november = await typeNovember(people);

    // Assert
    expect(rowOf(november, 'G').adjustments).toEqual([expect.objectContaining({ amount: -0.5, isRecurring: true })]);
    expect(totalsOf(november, 'G')).toMatchObject({ actual: 9, paid: 8.5 });
  });
});

describe('the order of the rows', () => {
  it('TC-XL-01: should list HCM before HN and official before probation, as both sheets do, whatever the codes', async () => {
    // Arrange: codes that sort the other way round
    await flow.addPerson({ code: 'NV1', regionId: flow.hn.id, employment: 'probation' });
    await flow.addPerson({ code: 'NV2', regionId: flow.hn.id, employment: 'official' });
    await flow.addPerson({ code: 'NV3', regionId: flow.hcm.id, employment: 'probation' });
    await flow.addPerson({ code: 'NV4', regionId: flow.hcm.id, employment: 'official' });

    // Act
    const dto = await flow.period(2026, 11);

    // Assert
    expect(dto.rows.map((r) => r.code)).toEqual(['NV4', 'NV3', 'NV2', 'NV1']);
  });
});
