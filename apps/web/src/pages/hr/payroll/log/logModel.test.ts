import { describe, expect, it } from 'vitest';
import type { PayrollLogLineDto } from '../../../../api';
import { linksOf, logFiltersFrom, logQueryOf, shownAction, shownDetail, type LogPerson } from './logModel';

/** What a line of Nhật ký lương points at, and what the address asks the API for (spec 4.4, 11.9; L-L11, L-I09). */

const PEOPLE: LogPerson[] = [
  { employeeId: 'nv-a', code: 'NV01', fullName: 'NV A' },
  { employeeId: 'nv-k', code: 'NV010', fullName: 'NV K' },
];

const line = (over: Partial<PayrollLogLineDto>): PayrollLogLineDto => ({
  id: '1',
  area: 'bang-luong',
  actor: 'HR',
  action: 'Sửa',
  detail: '',
  month: '2026-10',
  at: '2026-11-03T02:00:00.000Z',
  ...over,
});

const linkOf = (l: PayrollLogLineDto, kind: string) => linksOf(l, PEOPLE, '2026-11').find((x) => x.kind === kind);

describe('where a log line leads', () => {
  it('L-L11: should lead to the pay levels of the person a profile line is about', () => {
    // Arrange
    const about = line({
      area: 'ho-so',
      detail: 'Sửa hồ sơ của NV01 NV A, từ 01/10/2026: Tiền cơm 1.100.000 → 1.150.000',
    });

    // Act
    const person = linkOf(about, 'person');

    // Assert
    expect(person).toEqual({ kind: 'person', label: 'NV01 NV A', to: '/hr/luong/ho-so?ky=2026-11&hs=nv-a&phan=muc' });
  });

  it('should take the whole code, not a longer one that starts the same', () => {
    // Arrange
    const about = line({
      area: 'ho-so',
      month: null,
      detail: 'Thêm người phụ thuộc của NV010 NV K: 1 người, từ T11/2026',
    });

    // Act
    const person = linkOf(about, 'person');

    // Assert
    expect(person?.to).toBe('/hr/luong/ho-so?ky=2026-11&hs=nv-k');
  });

  it('should lead to Bảng lương of the month the line touches', () => {
    // Arrange
    const approved = line({ action: 'Duyệt', detail: 'Duyệt lần 1: 12 người' });

    // Act
    const links = linksOf(approved, PEOPLE, '2026-11');

    // Assert
    expect(links).toEqual([{ kind: 'month', label: 'Bảng lương T10/2026', to: '/hr/luong?ky=2026-10' }]);
  });

  it('should open the sources of the cell HR typed, for that person in that month', () => {
    // Arrange
    const typed = line({ action: 'Sửa đầu vào tháng', detail: 'NV01 NV A: % KPI trống → 80%' });

    // Act
    const cell = linkOf(typed, 'cell');

    // Assert
    expect(cell).toEqual({ kind: 'cell', label: 'Ô % KPI', to: '/hr/luong?ky=2026-10&tinh=kpiPercent&nguoi=nv-a' });
  });

  it('should show the row of the person when what HR typed is not a computed cell', () => {
    // Arrange
    const typed = line({ action: 'Sửa đầu vào tháng', detail: 'NV01 NV A: ghi chú trống → "x"' });

    // Act
    const cell = linkOf(typed, 'cell');

    // Assert
    expect(cell).toEqual({ kind: 'cell', label: 'Dòng lương', to: '/hr/luong?ky=2026-10&nv=nv-a' });
  });

  it('should open the setting a Cấu hình line names, by its key or by its label', () => {
    // Arrange
    const byKey = line({ area: 'cau-hinh', detail: 'Thêm khoan.com.thue cho NV01 NV A: chịu thuế, từ T10/2026' });
    const byLabel = line({
      area: 'cau-hinh',
      detail: 'Sửa Tháng đầu trên web cho tất cả: 2026-10 → 2026-11, từ T1/2026',
    });
    const unknown = line({ area: 'cau-hinh', detail: 'Sửa Vùng lương tối thiểu cho tất cả: I → II, từ T10/2026' });

    // Act
    const links = [byKey, byLabel, unknown].map((l) => linkOf(l, 'setting'));

    // Assert
    expect(links[0]?.to).toBe('/hr/luong/cau-hinh?ky=2026-10&khoa=khoan.com.thue');
    expect(links[1]).toEqual({
      kind: 'setting',
      label: 'Cấu hình: Tháng đầu trên web',
      to: '/hr/luong/cau-hinh?ky=2026-10&khoa=quy-tac.thang-dau',
    });
    expect(links[2]).toEqual({ kind: 'setting', label: 'Cấu hình', to: '/hr/luong/cau-hinh?ky=2026-10' });
  });

  it('should lead to Tài khoản HR from a rights line and to the timesheet log from a timesheet line', () => {
    // Arrange
    const rights = line({ area: 'quyen', month: null, detail: 'ketoan@congty.vn: Xem, sửa lương' });
    const closed = line({ area: 'cham-cong', action: 'Kỳ công chốt', detail: 'Tháng 10/2026' });

    // Act
    const account = linkOf(rights, 'rights');
    const timesheet = linkOf(closed, 'timesheet');

    // Assert
    expect(account?.to).toBe('/hr/tai-khoan');
    expect(timesheet?.to).toBe('/hr/cham-cong/nhat-ky');
  });
});

describe('the filters of the log in the address', () => {
  it('should ask for the pay month of the page when the address says nothing', () => {
    // Act
    const query = logQueryOf(logFiltersFrom(new URLSearchParams('')), '2026-11', 0);

    // Assert
    expect(query).toEqual({ month: '2026-11', offset: 0 });
  });

  it('should ask for every month, one group, one person, one HR and the typed words', () => {
    // Arrange
    const params = new URLSearchParams('moi-ky=1&nhom=ho-so&ma=NV01&ai=HR%20Hai&tim=%20c%C6%A1m%20');

    // Act
    const query = logQueryOf(logFiltersFrom(params), '2026-11', 100);

    // Assert
    expect(query).toEqual({ area: 'ho-so', personCode: 'NV01', actor: 'HR Hai', search: 'cơm', offset: 100 });
  });

  it('should ask for the approval steps alone under "duyet", and forget a group it does not know', () => {
    // Act
    const approvals = logQueryOf(logFiltersFrom(new URLSearchParams('nhom=duyet')), '2026-11', 0);
    const unknown = logQueryOf(logFiltersFrom(new URLSearchParams('nhom=khac')), '2026-11', 0);

    // Assert
    expect(approvals).toEqual({ isApprovalOnly: true, month: '2026-11', offset: 0 });
    expect(unknown).toEqual({ month: '2026-11', offset: 0 });
  });
});

describe('a log line in the words of HR (F18)', () => {
  it('should name the contract type and the pay components of a new level, and leave the amounts of 0 out', () => {
    // Arrange
    const detail =
      'Thêm hồ sơ của NV01 NV A, từ 26/09/2026: loại HĐ thu-viec, luong 6.000.000, trach-nhiem 0, com 1.200.000, xang-dt 0, KPI 0';

    // Act + Assert
    expect(shownDetail(detail)).toBe(
      'Thêm hồ sơ của NV01 NV A, từ 26/09/2026: HĐ thử việc · Lương thời gian 6.000.000 · Tiền cơm 1.200.000',
    );
  });

  it('should name what changed in a level, keeping a change to or from 0', () => {
    // Arrange
    const detail = 'Sửa hồ sơ của NV01 NV A, từ 26/09/2026: loại HĐ thu-viec → khong-thoi-han, com 0 → 1.200.000';

    // Act + Assert
    expect(shownDetail(detail)).toBe(
      'Sửa hồ sơ của NV01 NV A, từ 26/09/2026: HĐ thử việc → HĐLĐ không xác định thời hạn · Tiền cơm 0 → 1.200.000',
    );
  });

  it('should keep an id it does not know, and every other kind of line as written', () => {
    // Act + Assert
    expect(shownDetail('Thêm hồ sơ của NV01 NV A, từ 26/09/2026: loại HĐ thoi-vu, pc-doc-hai 500.000')).toBe(
      'Thêm hồ sơ của NV01 NV A, từ 26/09/2026: loại HĐ thoi-vu · pc-doc-hai 500.000',
    );
    expect(shownDetail('NV10 NV J: % KPI trống → 0%')).toBe('NV10 NV J: % KPI trống → 0%');
  });

  it('should call the month inputs "Gõ số trên bảng lương"', () => {
    // Act + Assert
    expect(shownAction('Sửa đầu vào tháng')).toBe('Gõ số trên bảng lương');
    expect(shownAction('Duyệt')).toBe('Duyệt');
  });
});
