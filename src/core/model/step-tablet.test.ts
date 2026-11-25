import { describe, expect, it } from 'vitest';
import { createFilmDocument, createPaperDocument } from './factory';
import { createMatcherDocument } from './factory';
import {
  STEP_TABLET_SLOTS,
  cloneStepTablet,
  documentStepTablet,
  importStepTabletFromDocument,
  isValidStepTablet,
} from './step-tablet';
import type { StepTablet } from './types';

/** Клин на 21 ступень: значение = 0.1·(ступень+1). */
function tablet(seed = 0.1): StepTablet {
  return { densities: Array.from({ length: 21 }, (_, i) => seed + i * 0.1) };
}

describe('активный клин документа (задача 8.1)', () => {
  it('документ плёнки отдаёт свой клин', () => {
    const doc = { ...createFilmDocument(), stepTablet: tablet() };
    expect(documentStepTablet(doc)).toBe(doc.stepTablet);
  });

  it('документ бумаги отдаёт свой клин', () => {
    const doc = { ...createPaperDocument(), stepTablet: tablet(0.2) };
    expect(documentStepTablet(doc)?.densities[0]).toBeCloseTo(0.2, 10);
  });

  it('у документа Matcher клина нет', () => {
    const doc = createMatcherDocument(createFilmDocument(), createPaperDocument());
    expect(documentStepTablet(doc)).toBeNull();
  });
});

describe('валидация клина', () => {
  it('непустой клин из конечных чисел пригоден', () => {
    expect(isValidStepTablet(tablet())).toBe(true);
  });

  it('пустой, отсутствующий или с нечислом — непригоден', () => {
    expect(isValidStepTablet(undefined)).toBe(false);
    expect(isValidStepTablet({ densities: [] })).toBe(false);
    expect(isValidStepTablet({ densities: [0.1, Number.NaN] })).toBe(false);
    expect(isValidStepTablet({ densities: [0.1, Number.POSITIVE_INFINITY] })).toBe(false);
  });
});

describe('копирование клина', () => {
  it('глубокая копия не делит массив с исходным', () => {
    const source = tablet();
    const copy = cloneStepTablet(source);
    copy.densities[0] = 9;
    expect(source.densities[0]).toBeCloseTo(0.1, 10);
  });

  it('константа числа сохранённых слотов', () => {
    expect(STEP_TABLET_SLOTS).toBe(2);
  });
});

describe('импорт клина из другого файла Plotter (задача 8.3)', () => {
  it('клин извлекается из документа плёнки', () => {
    const source = { ...createFilmDocument(), stepTablet: tablet(0.3) };
    const result = importStepTabletFromDocument(source);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tablet.densities[0]).toBeCloseTo(0.3, 10);
      // Копия, а не тот же объект.
      result.tablet.densities[0] = 0;
      expect(source.stepTablet.densities[0]).toBeCloseTo(0.3, 10);
    }
  });

  it('клин извлекается из документа бумаги', () => {
    const source = { ...createPaperDocument(), stepTablet: tablet(0.4) };
    const result = importStepTabletFromDocument(source);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tablet.densities[0]).toBeCloseTo(0.4, 10);
  });

  it('документ без клина сообщает об отсутствии', () => {
    const source = { ...createFilmDocument(), stepTablet: { densities: [] } };
    expect(importStepTabletFromDocument(source)).toEqual({ ok: false, error: 'no-tablet' });
  });

  it('документ Matcher отклоняется', () => {
    const source = createMatcherDocument(createFilmDocument(), createPaperDocument());
    expect(importStepTabletFromDocument(source)).toEqual({ ok: false, error: 'matcher' });
  });
});
