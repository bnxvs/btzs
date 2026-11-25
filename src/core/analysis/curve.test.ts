import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFilm } from '@/core/format';
import {
  averageGradient,
  baseFog,
  buildSamples,
  densityAt,
  firstCrossing,
  gradientAt,
  logERange,
  maxDensity,
} from '@/core/analysis';
import type { Sample } from '@/core/analysis';

const APP_DIR = join(process.cwd(), 'app');

function samplesOf(): Sample[] {
  const doc = readFilm(new Uint8Array(readFileSync(join(APP_DIR, '_400_TMax_ID11_23_75.pfc'))));
  return buildSamples(doc.curves[2], doc.stepTablet);
}

describe('buildSamples', () => {
  it('строит выборку, отсортированную по возрастанию logE', () => {
    const samples = samplesOf();
    expect(samples.length).toBeGreaterThan(2);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].logE).toBeGreaterThanOrEqual(samples[i - 1].logE);
    }
  });

  it('плотность не убывает с ростом logE (кривая характерного вида)', () => {
    const samples = samplesOf();
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].density).toBeGreaterThanOrEqual(samples[i - 1].density - 1e-9);
    }
  });
});

describe('logERange', () => {
  it('возвращает границы выборки', () => {
    const samples = samplesOf();
    const range = logERange(samples);
    expect(range.min).toBe(samples[0].logE);
    expect(range.max).toBe(samples[samples.length - 1].logE);
  });

  it('пустая выборка — нулевой диапазон', () => {
    expect(logERange([])).toEqual({ min: 0, max: 0 });
  });
});

describe('densityAt', () => {
  it('интерполирует между точками', () => {
    const samples: Sample[] = [
      { logE: 0, density: 0, step: 0 },
      { logE: 1, density: 1, step: 1 },
    ];
    expect(densityAt(samples, 0.5)).toBeCloseTo(0.5, 12);
  });

  it('возвращает undefined вне диапазона', () => {
    const samples: Sample[] = [
      { logE: 0, density: 0, step: 0 },
      { logE: 1, density: 1, step: 1 },
    ];
    expect(densityAt(samples, -0.1)).toBeUndefined();
    expect(densityAt(samples, 1.1)).toBeUndefined();
    expect(densityAt([], 0)).toBeUndefined();
  });
});

describe('gradientAt', () => {
  it('на прямолинейном участке равен наклону', () => {
    const samples: Sample[] = [
      { logE: 0, density: 0, step: 0 },
      { logE: 1, density: 0.6, step: 1 },
      { logE: 2, density: 1.2, step: 2 },
    ];
    expect(gradientAt(samples, 1)).toBeCloseTo(0.6, 9);
  });

  it('вырожденная выборка — 0', () => {
    expect(gradientAt([], 0)).toBe(0);
    expect(gradientAt([{ logE: 0, density: 1, step: 0 }], 0)).toBe(0);
  });
});

describe('averageGradient', () => {
  it('средний градиент на интервале равен разности плотностей / длине интервала', () => {
    const samples: Sample[] = [
      { logE: 0, density: 0, step: 0 },
      { logE: 1, density: 0.6, step: 1 },
      { logE: 2, density: 1.2, step: 2 },
    ];
    expect(averageGradient(samples, 0, 2)).toBeCloseTo(0.6, 9);
  });

  it('нулевой интервал — 0', () => {
    expect(averageGradient(samplesOf(), 0, 0)).toBe(0);
  });
});

describe('baseFog и maxDensity', () => {
  it('base+fog — минимальная плотность, Dmax — максимальная', () => {
    const samples = samplesOf();
    expect(baseFog(samples)).toBeLessThanOrEqual(maxDensity(samples));
    expect(baseFog(samples)).toBeCloseTo(Math.min(...samples.map((s) => s.density)), 12);
    expect(maxDensity(samples)).toBeCloseTo(Math.max(...samples.map((s) => s.density)), 12);
  });

  it('пустая выборка — 0', () => {
    expect(baseFog([])).toBe(0);
    expect(maxDensity([])).toBe(0);
  });
});

describe('firstCrossing', () => {
  it('находит первый переход предиката с интерполяцией', () => {
    const samples: Sample[] = [
      { logE: 0, density: 0, step: 0 },
      { logE: 1, density: 1, step: 1 },
      { logE: 2, density: 2, step: 2 },
    ];
    const crossing = firstCrossing(samples, (_l, d) => d >= 0.5);
    expect(crossing).not.toBeUndefined();
    expect(crossing!).toBeGreaterThan(0);
    expect(crossing!).toBeLessThan(1);
  });

  it('возвращает undefined, если перехода нет', () => {
    expect(firstCrossing(samplesOf(), () => false)).toBeUndefined();
  });
});
