import { describe, expect, it } from 'vitest';
import {
  STEP_COUNT,
  appendCurve,
  createFilmDocument,
  createPaperDocument,
  defaultStepTabletDensities,
  filledDensities,
  formatDevTime,
  importCurves,
  isValidDevTime,
  moveCurve,
  parseDevTime,
  removeCurve,
} from '@/core/model';
import type { Curve } from '@/core/model';

function curve(label: string, densities: number[]): Curve {
  return {
    label,
    note: '',
    points: densities.map((density, step) => ({ step, density })),
    reserved: Array.from({ length: 20 }, () => 0),
    dontConnectInChart: false,
  };
}

describe('автозаполнение ступеней (задача 5.1)', () => {
  it('введённые значения не меняются', () => {
    const points = [
      { step: 3, density: 1.2 },
      { step: 4, density: 1.0 },
    ];
    const filled = filledDensities(points, 5);
    expect(filled[3]).toBe(1.2);
    expect(filled[4]).toBe(1.0);
  });

  it('старшие ступени получают первое введённое значение', () => {
    const points = [
      { step: 5, density: 2.0 },
      { step: 6, density: 1.8 },
    ];
    const filled = filledDensities(points, 8);
    for (let step = 0; step < 5; step++) expect(filled[step]).toBe(2.0);
    expect(filled[6]).toBe(1.8);
    expect(filled[7]).toBeUndefined();
  });

  it('если введена первая ступень — автозаполнения нет', () => {
    const points = [{ step: 0, density: 0.5 }];
    const filled = filledDensities(points, 4);
    expect(filled[0]).toBe(0.5);
    expect(filled[1]).toBeUndefined();
  });

  it('пустая кривая — только undefined', () => {
    expect(filledDensities([], 3)).toEqual([undefined, undefined, undefined]);
  });

  it('клиновые значения по умолчанию монотонно растут', () => {
    const d = defaultStepTabletDensities();
    expect(d).toHaveLength(STEP_COUNT);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThan(d[i - 1]);
  });
});

describe('время проявления (задачи 5.3, 5.5)', () => {
  it('формат «минуты:секунды»', () => {
    expect(parseDevTime('5:30')).toBeCloseTo(5.5, 10);
    expect(parseDevTime('0:45')).toBeCloseTo(0.75, 10);
    expect(parseDevTime('12:00')).toBe(12);
  });

  it('десятичный формат', () => {
    expect(parseDevTime('5.5')).toBe(5.5);
    expect(parseDevTime('7')).toBe(7);
  });

  it('некорректный ввод → null (кривая помечается некорректной)', () => {
    expect(parseDevTime('N5.5')).toBeNull();
    expect(parseDevTime('abc')).toBeNull();
    expect(parseDevTime('')).toBeNull();
    expect(parseDevTime('5:99')).toBeNull(); // секунды ≥ 60
    expect(parseDevTime('-5')).toBeNull();
  });

  it('форматирование обратно разбираемо', () => {
    expect(formatDevTime(5.5)).toBe('5:30');
    expect(formatDevTime(7)).toBe('7');
    expect(parseDevTime(formatDevTime(5.5))).toBeCloseTo(5.5, 10);
  });

  it('isValidDevTime по метке кривой', () => {
    expect(isValidDevTime(curve('5:40', [1]))).toBe(true);
    expect(isValidDevTime(curve('N5.5', [1]))).toBe(false);
  });
});

describe('операции над кривыми (задачи 5.1, 5.6)', () => {
  it('appendCurve добавляет кривую, не меняя исходные', () => {
    const doc = createFilmDocument();
    const withOne = appendCurve(doc, curve('5:30', [1, 2]));
    expect(doc.curves).toHaveLength(0);
    expect(withOne.curves).toHaveLength(1);
    expect(withOne.curves[0].label).toBe('5:30');
  });

  it('removeCurve удаляет выбранную; без выбора — первую', () => {
    const doc = appendCurve(
      appendCurve(createFilmDocument(), curve('a', [1])),
      curve('b', [2]),
    );
    const r1 = removeCurve(doc, 1);
    expect(r1.removed?.label).toBe('b');
    expect(r1.doc.curves.map((c) => c.label)).toEqual(['a']);
    const r2 = removeCurve(doc);
    expect(r2.removed?.label).toBe('a');
    const r3 = removeCurve(doc, 5);
    expect(r3.removed).toBeUndefined();
    expect(r3.doc).toBe(doc);
  });

  it('moveCurve меняет порядок вверх/вниз и не выходит за границы', () => {
    const doc = appendCurve(
      appendCurve(appendCurve(createFilmDocument(), curve('a', [1])), curve('b', [2])),
      curve('c', [3]),
    );
    expect(moveCurve(doc, 0, 1).curves.map((c) => c.label)).toEqual(['b', 'a', 'c']);
    expect(moveCurve(doc, 2, 1).curves.map((c) => c.label)).toEqual(['a', 'b', 'c']);
    expect(moveCurve(doc, 0, -1).curves.map((c) => c.label)).toEqual(['a', 'b', 'c']);
    expect(moveCurve(doc, -1, 1)).toBe(doc);
  });
});

describe('импорт кривых (задачи 5.3, 5.6)', () => {
  it('импорт кривой бумаги в семейство плёнки отклоняется', () => {
    const film = createFilmDocument();
    const paper = appendCurve(createPaperDocument(), curve('0', [1]));
    const result = importCurves(film, paper);
    expect(result).toEqual({ ok: false, error: 'wrong-kind' });
  });

  it('импорт кривой плёнки в семейство бумаги отклоняется', () => {
    const film = appendCurve(createFilmDocument(), curve('5:30', [1]));
    expect(importCurves(createPaperDocument(), film)).toEqual({
      ok: false,
      error: 'wrong-kind',
    });
  });

  it('успешный импорт добавляет выбранные кривые', () => {
    const source = appendCurve(
      appendCurve(createFilmDocument(), curve('a', [1])), curve('b', [2]),
    );
    const target = appendCurve(createFilmDocument(), curve('x', [3]));
    const result = importCurves(target, source, [1]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.imported).toBe(1);
      expect(result.doc.curves.map((c) => c.label)).toEqual(['x', 'b']);
    }
    expect(target.curves).toHaveLength(1);
  });

  it('импорт из документа без кривых → ошибка', () => {
    const source = appendCurve(createFilmDocument(), curve('a', [1]));
    expect(importCurves(createFilmDocument(), source, [7])).toEqual({
      ok: false,
      error: 'no-curves',
    });
  });
});

describe('фабрики документов (задачи 5.1, 5.4)', () => {
  it('новый документ плёнки: пустые кривые, стандартный клин, параметры по умолчанию', () => {
    const doc = createFilmDocument();
    expect(doc.kind).toBe('film');
    expect(doc.curves).toHaveLength(0);
    expect(doc.stepTablet.densities).toHaveLength(STEP_COUNT);
    expect(doc.rawHeader.marker).toBe(104);
    expect(doc.rawHeader.settings).toHaveLength(0x48 - 0x0c);
    expect(doc.rawHeader.flag).toBe(1);
    expect(doc.analysisParams.idminPercent).toBe(90);
    expect(doc.family.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('новый документ бумаги: маркер 103, printMethod по умолчанию', () => {
    const doc = createPaperDocument();
    expect(doc.kind).toBe('paper');
    expect(doc.rawHeader.marker).toBe(103);
    expect(doc.family.printMethod).toBe('contact');
    expect(doc.analysisParams.idminPercent).toBe(90);
  });
});
