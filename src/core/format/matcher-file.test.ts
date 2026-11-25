import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readMatcher, writeMatcher } from './matcher-file';

const APP_DIR = join(process.cwd(), 'app');

function matcherFiles(): string[] {
  return readdirSync(APP_DIR).filter((f) => f.includes('.pmf'));
}

function readBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(APP_DIR, name)));
}

describe('кодек .pmf (Matcher)', () => {
  const files = matcherFiles();

  it('находит образцы Matcher', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('читает Matcher %s', (name) => {
    const doc = readMatcher(readBytes(name));
    expect(doc.kind).toBe('matcher');
    expect(doc.filmRef.path.length).toBeGreaterThan(0);
    expect(doc.paperRef.path.length).toBeGreaterThan(0);
    expect(doc.referenceCurveGrays).toHaveLength(10);
  });

  it.each(files)('round-trip без потерь: %s', (name) => {
    const original = readBytes(name);
    const doc = readMatcher(original);
    const written = writeMatcher(doc);
    expect(Array.from(written)).toEqual(Array.from(original));
  });

  it('отвергает файл с неверной сигнатурой', () => {
    const junk = new Uint8Array(200);
    expect(() => readMatcher(junk)).toThrow(/Matcher/i);
  });

  it('сохраняет и восстанавливает расширенное состояние приложения', () => {
    const original = readMatcher(readBytes(files[0]));
    const withState = {
      ...original,
      selectedFilmCurve: 2,
      selectedPaperCurve: 1,
      referenceCurveType: 'loaded' as const,
      analysisOverridden: true,
      lockFilmDrToEs: true,
      analysisParams: { ...original.analysisParams, es: 1.35, flareDensity: 0.02 },
      loadedReferenceCurve: {
        label: 'ref',
        note: '',
        points: [
          { step: 2, density: 0.1 },
          { step: 8, density: 1.9 },
        ],
        reserved: [],
        dontConnectInChart: false,
      },
      savedMatches: [
        {
          name: 'm',
          filmLabel: 'f',
          paperLabel: 'p',
          points: [{ step: 2, density: 0.2 }],
          source: 'external' as const,
          clipped: true,
        },
      ],
    };
    const round = readMatcher(writeMatcher(withState));
    expect(round.selectedFilmCurve).toBe(2);
    expect(round.selectedPaperCurve).toBe(1);
    expect(round.referenceCurveType).toBe('loaded');
    expect(round.analysisOverridden).toBe(true);
    expect(round.lockFilmDrToEs).toBe(true);
    expect(round.analysisParams.es).toBeCloseTo(1.35, 9);
    expect(round.loadedReferenceCurve?.points).toHaveLength(2);
    expect(round.savedMatches).toHaveLength(1);
    expect(round.savedMatches[0].source).toBe('external');
    expect(round.savedMatches[0].clipped).toBe(true);
  });

  it('документ без расширенного состояния пишется без хвоста (побайтово как образец)', () => {
    const doc = readMatcher(readBytes(files[0]));
    // Обнуляем состояние, которое в образце не выводится.
    const plain = {
      ...doc,
      selectedFilmCurve: 0,
      selectedPaperCurve: 0,
      analysisOverridden: false,
      lockFilmDrToEs: false,
    };
    expect(Array.from(writeMatcher(plain))).toEqual(Array.from(readBytes(files[0])));
  });
});
