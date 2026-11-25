import { describe, expect, it } from 'vitest';
import {
  AnalysisMethod,
  DEFAULTS,
  FILM_PAPER_TABS,
  FilmChart,
  LIMITS,
  MATCHER_TABS,
  ToeClass,
  ZONE_RANGE,
} from '@/core/model';

describe('перечисления и константы', () => {
  it('содержит методы анализа', () => {
    expect(Object.values(AnalysisMethod)).toEqual(['approximate-ci', 'over-fbf']);
  });

  it('задаёт границы зон 2..8', () => {
    expect(ZONE_RANGE).toEqual({ min: 2, max: 8 });
  });

  it('охватывает вкладки документов', () => {
    expect([...FILM_PAPER_TABS]).toEqual(['family', 'data', 'analyze', 'charts']);
    expect([...MATCHER_TABS]).toEqual(['info', 'film', 'paper', 'compare']);
  });

  it('содержит шесть плёночных графиков', () => {
    expect(Object.values(FilmChart)).toHaveLength(6);
  });

  it('содержит три класса носка', () => {
    expect(Object.values(ToeClass)).toEqual(['short', 'normal', 'long']);
  });

  it('фиксирует значения по умолчанию и ограничения', () => {
    expect(DEFAULTS.paperEs).toBe(1.0);
    expect(DEFAULTS.flareDensity).toBe(0);
    expect(DEFAULTS.zoneSpread).toBe(4);
    expect(DEFAULTS.analysisMethod).toBe('approximate-ci');
    expect(DEFAULTS.personalSpeedPoint).toBe(2.4);
    expect(DEFAULTS.idminPercent).toBe(90);
    expect(DEFAULTS.displayInformation).toBe(true);
    expect(DEFAULTS.smoothCurves).toBe(false);
    expect(DEFAULTS.colorCurves).toBe(true);
    expect(DEFAULTS.displayGrid).toBe(true);
    expect(DEFAULTS.printAllChartsOnSamePage).toBe(true);
    expect(LIMITS.maxComparisons).toBe(15);
    expect(LIMITS.stepCount).toBe(21);
  });
});
