import { describe, expect, it } from 'vitest';
import type { Atom } from './atoms.js';
import { parseRequirement } from './requirement.js';

function atomsOf(line: string): Atom[] {
  return parseRequirement(line).atoms;
}

function experienceOf(line: string) {
  return atomsOf(line).find((a) => a.kind === 'experience');
}

describe('parseRequirement: experience', () => {
  it.each([
    ['Kinh nghiệm: Từ 2 năm', 24],
    ['Tối thiểu 1 năm kinh nghiệm', 12],
    ['2+ năm kinh nghiệm', 24],
    ['Có ít nhất 6 tháng kinh nghiệm', 6],
    ['Kinh nghiệm 1 - 3 năm', 12],
    ['3+ years of experience', 36],
    ['Có hai năm kinh nghiệm làm việc', 24],
  ])('should read "%s" as at least %i months', (line, minMonths) => {
    expect(experienceOf(line)).toMatchObject({ minMonths });
  });

  it('should keep the field of experience with its synonyms', () => {
    const atom = experienceOf('Tối thiểu 1 năm kinh nghiệm bán hàng');
    expect(
      atom?.kind === 'experience' && atom.field !== null && atom.field !== 'related' ? atom.field.terms : [],
    ).toEqual(expect.arrayContaining(['ban hang', 'sales']));
  });

  it('should read the field written before the word "experience" in English', () => {
    const atom = experienceOf('3+ years of sales experience');
    expect(
      atom?.kind === 'experience' && atom.field !== null && atom.field !== 'related' ? atom.field.label : '',
    ).toContain('sales');
  });

  it('should treat "vị trí tương đương" as a related field that cannot be named', () => {
    expect(experienceOf('Có 2 năm kinh nghiệm ở vị trí tương đương')).toMatchObject({ field: 'related' });
  });

  it('should have no field for "Kinh nghiệm: Từ 2 năm"', () => {
    expect(experienceOf('Kinh nghiệm: Từ 2 năm')).toMatchObject({ field: null });
  });

  it.each([
    'Kinh nghiệm: Không yêu cầu',
    'Không yêu cầu kinh nghiệm',
    'Chưa có kinh nghiệm sẽ được đào tạo',
    'Kinh nghiệm: Dưới 1 năm',
  ])('should treat "%s" as trivially satisfied', (line) => {
    expect(parseRequirement(line).trivialReason).not.toBeNull();
  });
});

describe('parseRequirement: education', () => {
  it.each([
    ['Học vấn: Đại học trở lên', 4],
    ['Tốt nghiệp Cao đẳng/Đại học', 3],
    ["Bachelor's degree or higher", 4],
    ['Tốt nghiệp THPT trở lên', 1],
    ['Trung cấp trở lên', 2],
    ['Thạc sĩ Quản trị kinh doanh', 5],
  ])('should read "%s" as minimum level %i', (line, minLevel) => {
    expect(atomsOf(line).find((a) => a.kind === 'education')).toMatchObject({ minLevel });
  });

  it('should read majors and the "liên quan" escape hatch', () => {
    expect(atomsOf('Tốt nghiệp Đại học chuyên ngành Kế toán, Tài chính hoặc liên quan')[0]).toMatchObject({
      kind: 'education',
      majors: ['ke toan', 'tai chinh'],
      majorRelatedOnly: true,
    });
  });

  it('should treat "Học vấn: Không yêu cầu" and "Lao động phổ thông" as trivially satisfied', () => {
    expect(parseRequirement('Học vấn: Không yêu cầu').trivialReason).not.toBeNull();
    expect(parseRequirement('Lao động phổ thông').trivialReason).not.toBeNull();
  });
});

describe('parseRequirement: language', () => {
  it('should read a TOEIC score', () => {
    expect(atomsOf('TOEIC 600 trở lên')[0]).toMatchObject({ kind: 'language', test: 'toeic', minScore: 600 });
  });

  it('should read an IELTS score with a decimal', () => {
    expect(atomsOf('IELTS 6.5+')[0]).toMatchObject({ kind: 'language', test: 'ielts', minScore: 6.5 });
  });

  it('should read "tiếng Anh giao tiếp" as conversational level and not as a soft skill', () => {
    const parsed = parseRequirement('Tiếng Anh giao tiếp tốt');
    expect(parsed.atoms[0]).toMatchObject({ kind: 'language', language: 'english', minLevel: 3 });
    expect(parsed.softNote).toBeNull();
  });

  it('should read JLPT N2 as Japanese', () => {
    expect(atomsOf('Tiếng Nhật N2')[0]).toMatchObject({ kind: 'language', language: 'japanese', test: 'jlpt' });
  });
});

describe('parseRequirement: skills, licences, assets', () => {
  it('should require every tool on a multi-item line', () => {
    expect(atomsOf('Thành thạo Excel, Word')[0]).toEqual({
      kind: 'keywords',
      groupIds: ['excel', 'word'],
      mode: 'all',
    });
  });

  it('should accept either tool on an "hoặc" line', () => {
    expect(atomsOf('Biết ReactJS hoặc VueJS')[0]).toMatchObject({ groupIds: ['react', 'vue'], mode: 'any' });
  });

  it('should treat tools in brackets after a generic one as examples', () => {
    expect(atomsOf('Sử dụng CRM (HubSpot, Salesforce)')[0]).toMatchObject({ groupIds: ['crm'] });
    expect(atomsOf('Thành thạo tin học văn phòng (Word, Excel, PowerPoint)')[0]).toMatchObject({
      groupIds: ['office'],
    });
  });

  it('should prefer the longest synonym ("Google Sheets" is Excel, not two words)', () => {
    expect(atomsOf('Sử dụng Google Sheets')[0]).toMatchObject({ groupIds: ['excel'] });
  });

  it('should read a driving licence class', () => {
    expect(atomsOf('Có bằng lái xe B2')[0]).toEqual({ kind: 'license', licenseClass: 'b2', vehicle: 'car' });
  });

  it('should read "có xe máy" and "có laptop" as assets', () => {
    expect(atomsOf('Có xe máy và laptop cá nhân')[0]).toMatchObject({ groupIds: ['vehicle', 'laptop'] });
  });

  it('should not turn "kinh nghiệm sử dụng Excel" into a years requirement', () => {
    expect(atomsOf('Có kinh nghiệm sử dụng Excel')).toEqual([{ kind: 'keywords', groupIds: ['excel'], mode: 'all' }]);
  });
});

describe('parseRequirement: not measurable', () => {
  it.each([
    'Chủ động, chịu áp lực tốt',
    'Trung thực, cẩn thận',
    'Có tinh thần làm việc nhóm',
    'Nhiệt tình, ham học hỏi',
  ])('should mark the soft skill "%s" as unknown', (line) => {
    const parsed = parseRequirement(line);
    expect(parsed.atoms).toEqual([]);
    expect(parsed.unknownReason).toContain('HR tự đánh giá');
  });

  it.each(['Ưu tiên ứng viên biết tiếng Anh', 'Biết Photoshop là một lợi thế'])(
    'should flag "%s" as a preference while still reading what is preferred',
    (line) => {
      const parsed = parseRequirement(line);
      expect(parsed.preference).toBe(true);
      expect(parsed.atoms.length).toBe(1);
    },
  );

  it('should give the preference reason when nothing measurable is preferred', () => {
    expect(parseRequirement('Ưu tiên ứng viên năng động').unknownReason).toContain('ưu tiên');
  });

  it('should read "kinh nghiệm trong ngành" as a related field that cannot be named', () => {
    expect(experienceOf('Có kinh nghiệm trong ngành')).toMatchObject({ field: 'related' });
  });

  it('should drop a trailing "ưu tiên" clause but keep the mandatory part', () => {
    expect(atomsOf('Tốt nghiệp Đại học, ưu tiên ngành Kế toán')[0]).toMatchObject({ minLevel: 4, majors: [] });
  });

  it('should mark gender and age conditions as unknown', () => {
    expect(parseRequirement('Nam/Nữ, tuổi từ 22 - 35').unknownReason).toContain('HR xác nhận');
  });

  it('should note a soft part next to a measurable one', () => {
    expect(parseRequirement('Thành thạo Excel, chịu áp lực tốt').softNote).toContain('kỹ năng mềm');
  });
});
