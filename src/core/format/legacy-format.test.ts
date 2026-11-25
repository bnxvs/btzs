import { describe, expect, it } from 'vitest';
import { LIMITS } from '@/core/model';
import { readFilm, writeFilm } from './plotter-file';
import {
  LEGACY_FILM_MAGIC,
  LEGACY_PAPER_MAGIC,
  detectLegacyKind,
  documentFromLegacy,
  isLegacyFormat,
  legacyNeedsStepTabletImport,
  readLegacy,
} from './legacy-format';

/** Собирает синтетический файл старого формата: магия + N кривых. */
function makeLegacy(magic: string, curves: number[][], pad = 16): Uint8Array {
  const bytes: number[] = [];
  for (const ch of magic) bytes.push(ch.charCodeAt(0));
  for (let i = 0; i < pad; i++) bytes.push(0);
  for (const curve of curves) {
    for (const d of curve) {
      const buf = new ArrayBuffer(4);
      new DataView(buf).setFloat32(0, d, true);
      bytes.push(...new Uint8Array(buf));
    }
  }
  return Uint8Array.from(bytes);
}

/** 21 плотность в допустимом диапазоне. */
function curveValues(seed = 0.1): number[] {
  return Array.from({ length: LIMITS.stepCount }, (_, i) => seed + i * 0.1);
}

describe('импорт устаревших форматов', () => {
  it('распознаёт сигнатуру FILMPLOT как плёнку', () => {
    const data = makeLegacy(LEGACY_FILM_MAGIC, [curveValues()]);
    expect(detectLegacyKind(data)).toBe('film');
    expect(isLegacyFormat(data)).toBe(true);
  });

  it('распознаёт сигнатуру PAPRPLOT как бумагу', () => {
    const data = makeLegacy(LEGACY_PAPER_MAGIC, [curveValues()]);
    expect(detectLegacyKind(data)).toBe('paper');
  });

  it('импортирует одну кривую на 21 ступень', () => {
    const data = makeLegacy(LEGACY_FILM_MAGIC, [curveValues(0.2)]);
    const result = readLegacy(data);
    expect(result?.kind).toBe('film');
    expect(result?.curves).toHaveLength(1);
    expect(result?.curves[0]).toHaveLength(LIMITS.stepCount);
    expect(result?.curves[0][0].step).toBe(0);
    expect(result?.curves[0][0].density).toBeCloseTo(0.2, 5);
    expect(result?.curves[0][20].density).toBeCloseTo(2.2, 5);
    expect(result?.needsStepTablet).toBe(true);
  });

  it('импортирует несколько кривых подряд', () => {
    const data = makeLegacy(LEGACY_FILM_MAGIC, [curveValues(0.1), curveValues(0.3)]);
    const result = readLegacy(data);
    expect(result?.curves).toHaveLength(2);
    expect(result?.curves[1][0].density).toBeCloseTo(0.3, 5);
  });

  it('возвращает null для неподходящих данных', () => {
    expect(readLegacy(new Uint8Array(64))).toBeNull();
    expect(detectLegacyKind(new Uint8Array(64))).toBeNull();
    expect(isLegacyFormat(new Uint8Array(64))).toBe(false);
  });

  it('прерывает серию на плотности вне диапазона', () => {
    // Кривая с нулевым значением в середине не должна распознаться как 21 точка.
    const broken = curveValues();
    broken[5] = 0;
    const data = makeLegacy(LEGACY_PAPER_MAGIC, [broken]);
    expect(readLegacy(data)).toBeNull();
  });
});

describe('обработка файла старого формата без клина (задача 8.4)', () => {
  const tablet = { densities: Array.from({ length: LIMITS.stepCount }, () => 0.15) };

  it('после импорта требуется ступенчатый клин', () => {
    const result = readLegacy(makeLegacy(LEGACY_FILM_MAGIC, [curveValues()]))!;
    expect(legacyNeedsStepTabletImport(result)).toBe(true);
  });

  it('строит документ плёнки с подставленным клином и кривыми', () => {
    const result = readLegacy(makeLegacy(LEGACY_FILM_MAGIC, [curveValues(0.2)]))!;
    const doc = documentFromLegacy(result, tablet);
    expect(doc.kind).toBe('film');
    expect(doc.stepTablet.densities).toHaveLength(LIMITS.stepCount);
    expect(doc.curves).toHaveLength(1);
    // Кривые нумеруются по порядку распознавания.
    expect(doc.curves[0].label).toBe('1');
    expect(doc.curves[0].points[0].density).toBeCloseTo(0.2, 5);
    // Кривая готова к записи: reserved нормализован под маркер.
    expect(doc.curves[0].reserved.length).toBeGreaterThan(0);
  });

  it('строит документ бумаги с несколькими кривыми', () => {
    const result = readLegacy(
      makeLegacy(LEGACY_PAPER_MAGIC, [curveValues(0.1), curveValues(0.3)]),
    )!;
    const doc = documentFromLegacy(result, tablet);
    expect(doc.kind).toBe('paper');
    expect(doc.curves.map((c) => c.label)).toEqual(['1', '2']);
  });

  it('документ старого формата записывается и читается обратно', () => {
    const result = readLegacy(makeLegacy(LEGACY_FILM_MAGIC, [curveValues()]))!;
    const doc = documentFromLegacy(result, tablet);
    if (doc.kind !== 'film') throw new Error('ожидался документ плёнки');
    const reopened = readFilm(writeFilm(doc));
    expect(reopened.kind).toBe('film');
    expect(reopened.stepTablet.densities).toEqual(doc.stepTablet.densities);
    expect(reopened.curves).toHaveLength(doc.curves.length);
    expect(reopened.curves[0].points[0].density).toBeCloseTo(0.1, 5);
  });
});
