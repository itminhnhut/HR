import type { EmployeeDto, TimesheetLogPageDto } from '@careers/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFlow, type Flow } from '../test/timesheet-flow.js';

/** Email nhận phiếu lương of a person: optional, checked, kept when a save leaves it out. People are fake. */

let flow: Flow;

beforeAll(async () => {
  flow = await createFlow();
});

beforeEach(async () => {
  await flow.reset();
});

describe('email nhận phiếu lương', () => {
  it('should leave the email empty for someone it was never given to', async () => {
    // Act
    const person = await flow.addPerson({ code: 'NV21' });

    // Assert
    expect(person.email).toBeNull();
  });

  it('should save the email in lowercase and list it', async () => {
    // Act
    const person = await flow.addPerson({ code: 'NV21', email: ' NV21@Example.com ' });
    const list = await flow.call<EmployeeDto[]>('GET', '/employees');

    // Assert
    expect(person.email).toBe('nv21@example.com');
    expect(list.find((e) => e.id === person.id)?.email).toBe('nv21@example.com');
  });

  it('should refuse an address that is not an email', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV21' });

    // Act
    const wrong = await flow.attempt('PATCH', `/employees/${person.id}`, {
      ...person,
      id: undefined,
      email: 'nv21-at-example',
    });

    // Assert
    expect(wrong.status).toBe(422);
  });

  it('should keep the email when a save leaves it out, such as changing khối for many people', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV21', email: 'nv21@example.com' });
    const { id: _id, email: _email, ...fields } = person;

    // Act
    const saved = await flow.call<EmployeeDto>('PATCH', `/employees/${person.id}`, { ...fields, block: 'KD' });

    // Assert
    expect(saved.block).toBe('KD');
    expect(saved.email).toBe('nv21@example.com');
  });

  it('should clear the email when HR empties the field, and log the change', async () => {
    // Arrange
    const person = await flow.addPerson({ code: 'NV21', fullName: 'NV U', email: 'nv21@example.com' });

    // Act
    const saved = await flow.updatePerson(person, { email: '' });

    // Assert
    expect(saved.email).toBeNull();
    const log = await flow.call<TimesheetLogPageDto>('GET', '/log?nhom=nhan-vien');
    expect(log.lines[0]?.detail).toBe('NV21 NV U: Email nhận phiếu lương nv21@example.com → trống');
  });
});
