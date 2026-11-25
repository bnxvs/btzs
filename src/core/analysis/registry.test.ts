import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFilm, readPaper } from '@/core/format';
import {
  analyzeCurveAsFilm,
  analyzeDocument,
  defaultAnalysisParams,
  withAnalysisParams,
} from '@/core/analysis';

const APP_DIR = join(process.cwd(), 'app');

describe('реестр анализа', () => {
  it('анализирует документ плёнки', () => {
    const doc = readFilm(new Uint8Array(readFileSync(join(APP_DIR, '400 TMax ID-11 2+3 75.pfc'))));
    const result = analyzeDocument(doc);
    expect(result.kind).toBe('film');
    if (result.kind === 'film') {
      expect(result.film.curves).toHaveLength(doc.curves.length);
    }
  });

  it('анализирует документ бумаги', () => {
    const doc = readPaper(new Uint8Array(readFileSync(join(APP_DIR, 'Agfa_MCC.ppc'))));
    const result = analyzeDocument(doc);
    expect(result.kind).toBe('paper');
    if (result.kind === 'paper') {
      expect(result.paper).toHaveLength(doc.curves.length);
    }
  });

  it('анализ отдельной кривой совпадает с анализом документа', () => {
    const doc = readFilm(new Uint8Array(readFileSync(join(APP_DIR, '400 TMax ID-11 2+3 75.pfc'))));
    const single = analyzeCurveAsFilm(doc.curves[0], doc.stepTablet, doc.analysisParams, doc.family.filmIso);
    const whole = analyzeDocument(doc);
    if (whole.kind === 'film') {
      expect(single.speedPointLogE).toBe(whole.film.curves[0].speedPointLogE);
      expect(single.gBar).toBe(whole.film.curves[0].gBar);
    }
  });

  it('параметры по умолчанию соответствуют значениям Options', () => {
    const p = defaultAnalysisParams();
    expect(p.es).toBe(1.0);
    expect(p.zoneSpread).toBe(4);
    expect(p.personalSpeedPoint).toBe(2.4);
    expect(p.idminPercent).toBe(90);
    expect(p.method).toBe('approximate-ci');
    expect(withAnalysisParams(p, { es: 1.5 }).es).toBe(1.5);
    expect(withAnalysisParams(p, { es: 1.5 }).zoneSpread).toBe(4);
  });
});
