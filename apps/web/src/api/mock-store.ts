import { buildSeed, DB_VERSION, type MockDb, type MockHrUser } from './mock-seed';
import { ApiError } from './types';

/** The in-browser demo database (localStorage), shared by the mock API modules. */
const STORAGE_KEY = 'careers-demo-db';

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

let memory: MockDb | null = null;

export function load(): MockDb {
  if (memory) return memory;
  const store = safeStorage();
  const wantsReset = typeof location !== 'undefined' && new URLSearchParams(location.search).has('reset');
  if (store && !wantsReset) {
    try {
      const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? 'null') as MockDb | null;
      if (parsed?.version === DB_VERSION) return (memory = parsed);
    } catch {
      // Corrupt storage: fall through to a fresh seed.
    }
  }
  memory = buildSeed();
  save();
  return memory;
}

export function save() {
  try {
    safeStorage()?.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Private mode or full storage: keep working in memory.
  }
}

/** Test helper: start from a fresh seed. */
export function resetMockDb(now?: Date) {
  memory = buildSeed(now);
  save();
}

/** Demo delay. Add ?slow to the URL to see loading skeletons. */
export function delay<T>(value: T): Promise<T> {
  let slow = false;
  try {
    slow =
      typeof location !== 'undefined' &&
      (new URLSearchParams(location.search).has('slow') || sessionStorage.getItem('demo-slow') === '1');
    if (slow) sessionStorage.setItem('demo-slow', '1');
  } catch {
    // ignore
  }
  const ms = slow ? 1800 : 220;
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}

export const fail = (status: number, message: string, errors: Record<string, string> = {}, code?: string) =>
  Promise.reject(new ApiError(status, message, errors, code));

export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function requireHr(db: MockDb): MockHrUser {
  const me = db.hrUsers.find((u) => u.id === db.session.hr);
  if (!me) throw new ApiError(401, 'Phiên đăng nhập đã hết, đăng nhập lại.');
  return me;
}
