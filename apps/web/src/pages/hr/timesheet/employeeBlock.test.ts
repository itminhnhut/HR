import type { EmployeeDto } from '@careers/shared';
import { describe, expect, it } from 'vitest';
import { blockToSave, bulkResultWords, changeBlocks, inputWithBlock, suggestBlock } from './employeeBlock';

/** Khối of a person: the suggestion from the department and the bulk change. Made-up people. */
const person = (id: string, over: Partial<EmployeeDto> = {}): EmployeeDto => ({
  id, code: id.toUpperCase(), fullName: `Người ${id}`, department: 'Kế toán', title: 'Nhân viên', regionId: 'hcm', employment: 'official',
  staffKindId: 'k1', joinedOn: '2025-01-01', officialOn: '2025-03-01', leftOn: null, openingLeave: 1.5,
  email: null, block: null, joinedOnConfirmed: true, officialOnConfirmed: false, leftOnConfirmed: false, ...over,
});

describe('suggesting a block from the department', () => {
  it.each(['Kinh doanh', 'Phòng KINH DOANH 2', 'kinh doanh', 'Sales', 'Telesale HN', 'Kinh Doanh Online'])('should suggest KD for the sales department "%s"', (department) => {
    expect(suggestBlock(department)).toBe('KD');
  });

  it.each(['Kế toán', 'Nhân sự', 'IT', ''])('should suggest BO for "%s"', (department) => {
    expect(suggestBlock(department)).toBe('BO');
  });

  it('should go by another rule when one is given', () => {
    // Arrange
    const rule = { rules: [{ block: 'KD' as const, words: ['tư vấn'] }], otherwise: 'BO' as const };

    // Act + Assert
    expect(suggestBlock('Tu van tuyen sinh', rule)).toBe('KD');
    expect(suggestBlock('Kinh doanh', rule)).toBe('BO');
  });
});

describe('changing the block of many people', () => {
  it('should send everything the API asks for, with only the block changed', () => {
    // Arrange
    const a = person('a');

    // Act
    const input = inputWithBlock(a, 'KD');

    // Assert
    expect(input).toEqual({ code: 'A', fullName: 'Người a', department: 'Kế toán', title: 'Nhân viên', regionId: 'hcm', employment: 'official', staffKindId: 'k1', joinedOn: '2025-01-01', officialOn: '2025-03-01', leftOn: null, openingLeave: 1.5, block: 'KD' });
  });

  it('should save each person and say how many were saved, naming in full who was not', async () => {
    // Arrange: the second save fails
    const people = [person('a'), person('b', { fullName: 'Người Thứ Hai' }), person('c')];
    const sent: string[] = [];
    const save = async (id: string) => {
      sent.push(id);
      if (id === 'b') throw new Error('Mất mạng');
    };

    // Act
    const result = await changeBlocks(people, 'BO', save, (e) => (e instanceof Error ? e.message : ''));

    // Assert
    expect(sent).toEqual(['a', 'b', 'c']);
    expect(bulkResultWords(result)).toBe('Đã lưu 2/3 người');
    expect(result.failed).toEqual(['Người Thứ Hai: Mất mạng']);
  });
});

describe('the block a form saves', () => {
  it('should save the suggestion of the department for a new person HR did not touch', () => {
    expect(blockToSave({ isNew: true, isTouched: false, picked: '', department: 'Kinh doanh' })).toBe('KD');
    expect(blockToSave({ isNew: true, isTouched: false, picked: '', department: 'Kế toán' })).toBe('BO');
  });

  it('should save what HR picked over the suggestion, none included', () => {
    expect(blockToSave({ isNew: true, isTouched: true, picked: 'BO', department: 'Kinh doanh' })).toBe('BO');
    expect(blockToSave({ isNew: true, isTouched: true, picked: '', department: 'Kinh doanh' })).toBeNull();
  });

  it('should never save a suggestion for someone already on the list', () => {
    expect(blockToSave({ isNew: false, isTouched: false, picked: '', department: 'Kinh doanh' })).toBeNull();
    expect(blockToSave({ isNew: false, isTouched: false, picked: 'BO', department: 'Kinh doanh' })).toBe('BO');
  });
});
