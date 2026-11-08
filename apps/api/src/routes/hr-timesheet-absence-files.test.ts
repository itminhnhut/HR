import { ABSENCE_FILE_MAX_BYTES, type AbsenceFileDto, type AbsenceKindDto, type AbsenceRowDto, type TimesheetAbsenceDto, type TimesheetLogPageDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { timesheetSnapshots } from '../db/schema.js';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/** Papers kept with an absence, over the real API (spec-giay-to-nghi.md). Cases TC-GT-01..07, 10, 11. */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

const JPEG = (size = 2000) => { const b = new Uint8Array(size); b.set([0xff, 0xd8, 0xff, 0xe0]); return b; };
const PDF = new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');

/** An approved sick leave on 12–13/10/2026. */
async function sickLeave(): Promise<TimesheetAbsenceDto> {
  const person = await flow.addPerson({ code: 'A' });
  const list = await flow.call<TimesheetAbsenceDto[]>('POST', `/employees/${person.id}/absences`, { reason: 'sick', code: 'OM', from: '2026-10-12', to: '2026-10-13', isHalf: false, approvedBy: 'Chị Hoa', handover: '', note: '' }, 201);
  const [absence] = list;
  if (!absence) throw new Error('No absence registered');
  return absence;
}

async function upload(absenceId: string, bytes: Uint8Array<ArrayBuffer>, name: string, expected = 201) {
  const form = new FormData();
  form.append('file', new File([bytes], name));
  const res = await flow.raw('POST', `/absences/${absenceId}/files`, { body: form });
  const text = await res.text();
  expect(res.status, text).toBe(expected);
  return JSON.parse(text) as AbsenceFileDto[] & { code?: string };
}

/** What the single log shows in the Nghỉ group about papers. */
const logOf = async () => (await flow.call<TimesheetLogPageDto>('GET', '/log?nhom=nghi')).lines.filter((l) => l.action.includes('giấy tờ'));

describe('keeping papers with an absence', () => {
  it('TC-GT-01: should keep three photos with an absence, in the order they came, and list them with it', async () => {
    // Arrange
    const absence = await sickLeave();

    // Act
    await upload(absence.id, JPEG(), 'trang-1.jpg');
    await upload(absence.id, JPEG(), 'trang-2.jpg');
    const files = await upload(absence.id, PDF, 'ra-vien.pdf');
    const listed = await flow.call<TimesheetAbsenceDto[]>('GET', `/employees/${(await flow.call<{ id: string }[]>('GET', '/employees'))[0]?.id}/absences`);

    // Assert
    expect(files.map((f) => [f.name, f.contentType])).toEqual([['trang-1.jpg', 'image/jpeg'], ['trang-2.jpg', 'image/jpeg'], ['ra-vien.pdf', 'application/pdf']]);
    expect(listed[0]?.files.map((f) => f.name)).toEqual(['trang-1.jpg', 'trang-2.jpg', 'ra-vien.pdf']);
  });

  it('TC-GT-02: should refuse a program renamed to .jpg, and keep nothing of it', async () => {
    // Arrange
    const absence = await sickLeave();

    // Act
    const answer = await upload(absence.id, new TextEncoder().encode('MZ\x90\x00 not a photo'), 'giay.jpg', 400);

    // Assert
    expect(answer.code).toBe('not_allowed');
    expect(flow.t.paperStore.files.size).toBe(0);
  });

  it('TC-GT-03: should refuse an eleventh file', async () => {
    // Arrange
    const absence = await sickLeave();
    for (let i = 1; i <= 10; i += 1) await upload(absence.id, JPEG(), `${i}.jpg`);

    // Act
    const answer = await upload(absence.id, JPEG(), '11.jpg', 409);

    // Assert
    expect(answer.code).toBe('too_many_files');
    expect(flow.t.paperStore.files.size).toBe(10);
  });

  it('TC-GT-04: should refuse a file over 4 MB', async () => {
    // Arrange
    const absence = await sickLeave();

    // Act
    const answer = await upload(absence.id, JPEG(ABSENCE_FILE_MAX_BYTES + 1), 'lon.jpg', 400);

    // Assert
    expect(answer.code).toBe('too_large');
  });

  it('TC-GT-05: should show a file only to HR signed in, as it was sent, kept out of caches', async () => {
    // Arrange
    const absence = await sickLeave();
    const [file] = await upload(absence.id, PDF, 'ra-vien.pdf');

    // Act
    const signedOut = await flow.raw('GET', `/absence-files/${file?.id}`, { signedIn: false });
    const signedIn = await flow.raw('GET', `/absence-files/${file?.id}`);

    // Assert
    expect(signedOut.status).toBe(401);
    expect(signedIn.status).toBe(200);
    expect(signedIn.headers.get('content-type')).toBe('application/pdf');
    expect(signedIn.headers.get('cache-control')).toBe('private, no-store');
    expect(new Uint8Array(await signedIn.arrayBuffer())).toEqual(PDF);
  });

  it('TC-GT-06: should remove the files from the store when the absence is cancelled, and log it', async () => {
    // Arrange
    const absence = await sickLeave();
    await upload(absence.id, JPEG(), 'trang-1.jpg');
    await upload(absence.id, JPEG(), 'trang-2.jpg');
    const [person] = await flow.call<{ id: string }[]>('GET', '/employees');

    // Act
    await flow.call('DELETE', `/employees/${person?.id}/absences/${absence.id}`);

    // Assert
    expect(flow.t.paperStore.files.size).toBe(0);
    expect((await logOf()).map((l) => l.action)).toContain('Xoá giấy tờ');
  });

  it('TC-GT-07: should take papers on an absence in a closed period, and leave its numbers as they closed', async () => {
    // Arrange: October closed with the sick leave in it
    const absence = await sickLeave();
    await flow.close(2026, 10);
    const before = await flow.t.db.select().from(timesheetSnapshots);

    // Act
    await upload(absence.id, JPEG(), 'giay-om.jpg');

    // Assert
    expect(await flow.t.db.select().from(timesheetSnapshots)).toEqual(before);
  });

  it('TC-GT-10: should log adding and removing a file, and not looking at one', async () => {
    // Arrange
    const absence = await sickLeave();
    const [file] = await upload(absence.id, JPEG(), 'giay-om.jpg');

    // Act
    await flow.raw('GET', `/absence-files/${file?.id}`);
    const left = await flow.call<AbsenceFileDto[]>('DELETE', `/absence-files/${file?.id}`);

    // Assert
    expect(left).toEqual([]);
    expect(flow.t.paperStore.files.size).toBe(0);
    expect((await logOf()).map((l) => [l.action, l.detail]).sort()).toEqual([
      ['Thêm giấy tờ', 'Người Thử, Ốm có giấy BHXH 12/10–13/10: giay-om.jpg'],
      ['Xoá giấy tờ', 'Người Thử, Ốm có giấy BHXH 12/10–13/10: giay-om.jpg'],
    ]);
  });

  it('TC-GT-11: should not find a file or an absence that is not there', async () => {
    // Act + Assert
    expect((await flow.raw('GET', '/absence-files/6f1c2a7e-0b1d-4c8e-9a51-2f3b4c5d6e7f')).status).toBe(404);
    expect((await flow.raw('GET', '/absence-files/khong-phai-id')).status).toBe(404);
    const form = new FormData();
    form.append('file', new File([JPEG()], 'a.jpg'));
    expect((await flow.raw('POST', '/absences/6f1c2a7e-0b1d-4c8e-9a51-2f3b4c5d6e7f/files', { body: form })).status).toBe(404);
  });
});


describe('which reasons ask for papers', () => {
  const kinds = () => flow.call<AbsenceKindDto[]>('GET', '/absence-kinds');
  const needs = (list: AbsenceKindDto[], key: string) => list.find((k) => k.key === key)?.needsPaper;
  const rowsOf2026 = () => flow.call<AbsenceRowDto[]>('GET', '/absences?year=2026');

  it('TC-GT-08: should stop asking for papers on sick leave once HR turns it off, and say so in the log', async () => {
    // Arrange
    const absence = await sickLeave();
    const before = await rowsOf2026();

    // Act
    const after = await flow.call<AbsenceKindDto[]>('PUT', '/absence-kinds/sick/needs-paper', { needsPaper: false });

    // Assert
    expect(before.find((r) => r.id === absence.id)?.needsPaper).toBe(true);
    expect(needs(after, 'sick')).toBe(false);
    expect((await rowsOf2026()).find((r) => r.id === absence.id)?.needsPaper).toBe(false);
    const log = (await flow.call<TimesheetLogPageDto>('GET', '/log?nhom=cau-hinh')).lines.map((l) => [l.action, l.detail]);
    expect(log).toContainEqual(['Sửa loại nghỉ', 'Ốm có giấy BHXH: không cần giấy tờ']);
  });

  it('TC-GT-09: should give a reason HR added its own switch, off at first', async () => {
    // Arrange
    const added = await flow.call<AbsenceKindDto[]>('POST', '/absence-kinds', { name: 'Khám thai', code: 'CL', days: 1 }, 201);
    const own = added.find((k) => k.name === 'Khám thai');

    // Act
    const after = await flow.call<AbsenceKindDto[]>('PUT', `/absence-kinds/${own?.key}/needs-paper`, { needsPaper: true });

    // Assert
    expect(own?.needsPaper).toBe(false);
    expect(needs(after, own?.key ?? '')).toBe(true);
    expect(needs(after, 'annual')).toBe(false);
  });

  it('TC-GT-12: should keep the defaults until HR changes them, and refuse a switch that is not yes or no', async () => {
    // Act
    const list = await kinds();
    const wrong = await flow.attempt('PUT', '/absence-kinds/sick/needs-paper', { needsPaper: 'có' });
    const missing = await flow.attempt('PUT', '/absence-kinds/khong-co/needs-paper', { needsPaper: true });

    // Assert
    expect(list.filter((k) => k.needsPaper).map((k) => k.key).sort()).toEqual(['child-wedding', 'funeral-close', 'maternity', 'sick', 'wedding']);
    expect(wrong.status).toBe(422);
    expect(missing.status).toBe(404);
  });
});
