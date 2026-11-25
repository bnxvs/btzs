import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFilm } from '@/core/format';
import {
  applyAdjustments,
  applyExposureAdjustment,
  applyFlare,
  buildSamples,
  extendForLowGradient,
  medianDensity,
  negativeDensityZones,
  printZoneBounds,
  subjectZones,
  zonesMedian,
} from '@/core/analysis';
import type { Sample } from '@/core/analysis';

const APP_DIR = join(process.cwd(), 'app');

function samplesOf(): Sample[] {
  const doc = readFilm(new Uint8Array(readFileSync(join(APP_DIR, '_400_TMax_ID11_23_75.pfc'))));
  return buildSamples(doc.curves[2], doc.stepTablet);
}

describe('flare и коррекция экспозиции', () => {
  it('без вуали выборка не изменяется', () => {
    const samples = samplesOf();
    expect(applyFlare(samples, 0)).toEqual(samples);
  });

  it('рост вуали монотонно повышает плотность', () => {
    const samples = samplesOf();
    const low = applyFlare(samples, 0.01);
    const high = applyFlare(samples, 0.05);
    for (let i = 0; i < samples.length; i++) {
      expect(high[i].density).toBeGreaterThan(low[i].density);
      expect(low[i].density).toBeGreaterThanOrEqual(samples[i].density);
    }
  });

  it('вуаль не меняет координаты logE', () => {
    const samples = samplesOf();
    const flared = applyFlare(samples, 0.05);
    for (let i = 0; i < samples.length; i++) {
      expect(flared[i].logE).toBe(samples[i].logE);
    }
  });

  it('положительная коррекция экспозиции сдвигает кривую влево', () => {
    const samples = samplesOf();
    const shifted = applyExposureAdjustment(samples, 1);
    for (let i = 0; i < samples.length; i++) {
      expect(shifted[i].logE).toBeCloseTo(samples[i].logE - Math.log10(2), 12);
      expect(shifted[i].density).toBe(samples[i].density);
    }
  });

  it('отрицательная и положительная коррекция симметричны', () => {
    const samples = samplesOf();
    const up = applyExposureAdjustment(samples, 1);
    const down = applyExposureAdjustment(samples, -1);
    expect(down[0].logE).toBeGreaterThan(samples[0].logE);
    expect(up[0].logE).toBeLessThan(samples[0].logE);
  });

  it('applyAdjustments применяет обе операции', () => {
    const samples = samplesOf();
    const combined = applyAdjustments(samples, 0.02, 1);
    const sequential = applyExposureAdjustment(applyFlare(samples, 0.02), 1);
    expect(combined).toEqual(sequential);
  });
});

describe('зоны плёнки', () => {
  it('создаёт зоны 2..8 (7 штук) равномерно', () => {
    const zones = subjectZones(samplesOf(), -2, 1.5);
    expect(zones.map((z) => z.zone)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].logE - zones[i - 1].logE).toBeCloseTo(zones[1].logE - zones[0].logE, 9);
    }
  });

  it('плотность зоны не убывает по ходу зон (на монотонной части)', () => {
    const samples = samplesOf();
    const zones = subjectZones(samples, samples[3].logE, 1.2);
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].density).toBeGreaterThanOrEqual(zones[i - 1].density - 1e-9);
    }
  });

  it('зоны плотности негатива соответствуют зонам сюжета', () => {
    const zones = subjectZones(samplesOf(), -2, 1.5);
    const neg = negativeDensityZones(zones);
    expect(neg).toHaveLength(7);
    expect(neg[0]).toEqual({ zone: 2, density: zones[0].density });
  });
});

describe('продление кривой при низком градиенте', () => {
  it('продлевает кривую до целевой плотности в направлении роста', () => {
    const samples = samplesOf();
    const last = samples[samples.length - 1];
    const target = last.density + 0.5;
    const extension = extendForLowGradient(samples, target);
    expect(extension.length).toBeGreaterThan(0);
    expect(extension[0].density).toBeGreaterThan(last.density);
    expect(extension[extension.length - 1].density).toBeCloseTo(target, 6);
    for (let i = 1; i < extension.length; i++) {
      expect(extension[i].logE).toBeGreaterThan(extension[i - 1].logE);
      expect(extension[i].density).toBeGreaterThan(extension[i - 1].density);
    }
  });

  it('не продлевает, если целевая плотность уже достигнута', () => {
    const samples = samplesOf();
    const last = samples[samples.length - 1];
    expect(extendForLowGradient(samples, last.density - 0.1)).toEqual([]);
  });
});

describe('зоны печати', () => {
  it('границы зон печати монотонны и полны', () => {
    const bounds = printZoneBounds(samplesOf(), -3, -1);
    expect(bounds).toHaveLength(7);
    for (let i = 1; i < bounds.length; i++) {
      expect(bounds[i].low).toBeGreaterThanOrEqual(bounds[i - 1].low - 1e-9);
    }
  });

  it('медиана зоны лежит между границами', () => {
    const bounds = printZoneBounds(samplesOf(), -3, -1);
    for (const b of bounds) {
      expect(b.median).toBeGreaterThanOrEqual(b.low - 1e-9);
      expect(b.median).toBeLessThanOrEqual(b.high + 1e-9);
    }
  });
});

describe('medianDensity (задача 4.9)', () => {
  it('медиана чётного и нечётного числа значений', () => {
    expect(medianDensity([1, 3])).toBe(2);
    expect(medianDensity([3, 1, 2])).toBe(2);
    expect(medianDensity([5, 1, 3, 2, 4])).toBe(3);
  });

  it('порядок значений не влияет на медиану', () => {
    expect(medianDensity([4, 1, 3, 2])).toBe(medianDensity([1, 2, 3, 4]));
  });

  it('пустой набор — 0', () => {
    expect(medianDensity([])).toBe(0);
  });

  it('zonesMedian — медиана медиан зон печати', () => {
    const bounds = printZoneBounds(samplesOf(), -3, -1);
    expect(zonesMedian(bounds)).toBe(medianDensity(bounds.map((b) => b.median)));
    expect(zonesMedian([])).toBe(0);
  });
});
