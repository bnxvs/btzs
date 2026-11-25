import { STEP_COUNT, defaultStepTabletDensities, isValidStepTablet } from '@/core/model';
import type { StepTablet } from '@/core/model';

/**
 * `store/step-tablets` — два сохранённых по умолчанию ступенчатых клина
 * (Step Tablet #1 и #2), переживающих перезапуск приложения.
 *
 * Хранение — в `localStorage` с резервным in-memory хранилищем (в тестах без
 * `localStorage`, например в Node/jsdom, клинья живут в памяти процесса).
 * Требования — `step-tablet/spec.md`.
 */

/** Ключ хранилища сохранённых клиньев. */
export const STEP_TABLET_STORAGE_KEY = 'plotter.stepTablets';

/** Число слотов сохранённых клиньев (Step Tablet #1 и #2). */
export const SAVED_TABLET_COUNT = 2;

/** Номер слота сохранённого клина: 0 — #1, 1 — #2. */
export type StepTabletSlot = 0 | 1;

const memoryStore = new Map<string, string>();

function storageGet(key: string): string | null {
  try {
    const value = globalThis.localStorage?.getItem(key);
    if (value !== undefined && value !== null) return value;
  } catch {
    /* хранилище недоступно */
  }
  return memoryStore.get(key) ?? null;
}

function storageSet(key: string, value: string): void {
  memoryStore.set(key, value);
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* хранилище недоступно — значение остаётся в памяти */
  }
}

/** Клин по умолчанию для пустого слота (равномерный 0.15/ступень). */
function defaultTablet(): StepTablet {
  return { densities: defaultStepTabletDensities(STEP_COUNT) };
}

/**
 * Разбирает сохранённую строку в два клина. Отсутствующие или испорченные
 * записи заменяются значением по умолчанию, поэтому результат всегда — два
 * пригодных клина.
 */
export function parseSavedStepTablets(raw: string | null): [StepTablet, StepTablet] {
  const defaults: [StepTablet, StepTablet] = [defaultTablet(), defaultTablet()];
  if (!raw) return defaults;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!Array.isArray(parsed)) return defaults;
  return parsed.slice(0, SAVED_TABLET_COUNT).reduce<[StepTablet, StepTablet]>(
    (acc, candidate, index) => {
      if (candidate && typeof candidate === 'object' && isValidStepTablet(candidate as StepTablet)) {
        acc[index] = { densities: [...(candidate as StepTablet).densities] };
      }
      return acc;
    },
    defaults,
  );
}

/**
 * Читает два сохранённых клина. Отсутствующие или испорченные записи
 * заменяются значением по умолчанию, поэтому результат всегда — два
 * пригодных клина.
 */
export function loadSavedStepTablets(): [StepTablet, StepTablet] {
  return parseSavedStepTablets(storageGet(STEP_TABLET_STORAGE_KEY));
}

/** Читает сохранённый клин по номеру слота. */
export function savedStepTablet(slot: StepTabletSlot): StepTablet {
  return loadSavedStepTablets()[slot];
}

/** Сохраняет клин в слот #1/#2 (перезаписывает). */
export function saveStepTablet(slot: StepTabletSlot, tablet: StepTablet): void {
  const all = loadSavedStepTablets();
  all[slot] = { densities: [...tablet.densities] };
  storageSet(STEP_TABLET_STORAGE_KEY, JSON.stringify(all));
}

/** Сбрасывает сохранённые клинья к значениям по умолчанию. */
export function resetSavedStepTablets(): void {
  memoryStore.delete(STEP_TABLET_STORAGE_KEY);
  try {
    globalThis.localStorage?.removeItem(STEP_TABLET_STORAGE_KEY);
  } catch {
    /* хранилище недоступно */
  }
}
