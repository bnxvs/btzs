import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STEP_COUNT } from '@/core/model';
import type { StepTablet } from '@/core/model';
import {
  SAVED_TABLET_COUNT,
  loadSavedStepTablets,
  parseSavedStepTablets,
  resetSavedStepTablets,
  saveStepTablet,
  savedStepTablet,
} from './step-tablets';

function custom(seed: number): StepTablet {
  return { densities: Array.from({ length: STEP_COUNT }, (_, i) => seed + i * 0.01) };
}

beforeEach(() => resetSavedStepTablets());
afterEach(() => resetSavedStepTablets());

describe('хранилище сохранённых клиньев', () => {
  it('без сохранённых данных отдаёт два клина по умолчанию на 21 ступень', () => {
    const saved = loadSavedStepTablets();
    expect(saved).toHaveLength(SAVED_TABLET_COUNT);
    for (const tablet of saved) {
      expect(tablet.densities).toHaveLength(STEP_COUNT);
      expect(tablet.densities[0]).toBeCloseTo(0, 10);
      expect(tablet.densities[1]).toBeCloseTo(0.15, 10);
    }
  });

  it('сохраняет и читает клин в слот #1', () => {
    saveStepTablet(0, custom(1.2));
    expect(savedStepTablet(0).densities[0]).toBeCloseTo(1.2, 10);
    // Слот #2 не тронут.
    expect(savedStepTablet(1).densities[0]).toBeCloseTo(0, 10);
  });

  it('сохраняет клин в слот #2 независимо от #1', () => {
    saveStepTablet(0, custom(2.0));
    saveStepTablet(1, custom(3.0));
    expect(savedStepTablet(0).densities[0]).toBeCloseTo(2.0, 10);
    expect(savedStepTablet(1).densities[0]).toBeCloseTo(3.0, 10);
  });

  it('глубокая копия: изменение возвращённого клина не меняет хранилище', () => {
    saveStepTablet(0, custom(1.0));
    const first = savedStepTablet(0);
    first.densities[0] = 99;
    expect(savedStepTablet(0).densities[0]).toBeCloseTo(1.0, 10);
  });

  it('испорченная запись заменяется значением по умолчанию', () => {
    const saved = parseSavedStepTablets('{not json');
    expect(saved[0].densities[1]).toBeCloseTo(0.15, 10);
  });

  it('запись без массива плотностей отбрасывается', () => {
    const saved = parseSavedStepTablets(JSON.stringify([{ nope: true }, custom(4.4)]));
    expect(saved[0].densities[1]).toBeCloseTo(0.15, 10); // дефолт
    expect(saved[1].densities[0]).toBeCloseTo(4.4, 10); // валидная запись
  });

  it('сброс возвращает значения по умолчанию', () => {
    saveStepTablet(0, custom(5.5));
    resetSavedStepTablets();
    expect(savedStepTablet(0).densities[0]).toBeCloseTo(0, 10);
  });
});
