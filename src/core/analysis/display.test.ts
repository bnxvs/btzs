import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readFilm } from '@/core/format';
import { buildSamples, smoothForDisplay } from '@/core/analysis';
import type { Sample } from '@/core/analysis';

const APP_DIR = join(process.cwd(), 'app');

function samplesOf(): Sample[] {
  const doc = readFilm(new Uint8Array(readFileSync(join(APP_DIR, '_400_TMax_ID11_23_75.pfc'))));
  return buildSamples(doc.curves[2], doc.stepTablet);
}

describe('сглаживание — только отображение', () => {
  it('не изменяет исходную выборку и координаты', () => {
    const samples = samplesOf();
    const before = JSON.parse(JSON.stringify(samples));
    const smooth = smoothForDisplay(samples, 50);
    expect(samples).toEqual(before);
    expect(smooth).not.toBe(samples);
    expect(smooth).toHaveLength(50);
  });

  it('границы logE сохраняются', () => {
    const samples = samplesOf();
    const smooth = smoothForDisplay(samples, 40);
    expect(smooth[0].logE).toBeCloseTo(samples[0].logE, 12);
    expect(smooth[smooth.length - 1].logE).toBeCloseTo(
      samples[samples.length - 1].logE,
      12,
    );
  });

  it('точки результата упорядочены по logE', () => {
    const smooth = smoothForDisplay(samplesOf(), 64);
    for (let i = 1; i < smooth.length; i++) {
      expect(smooth[i].logE).toBeGreaterThan(smooth[i - 1].logE);
    }
  });

  it('исходные координаты ступеней не попадают в результат', () => {
    const smooth = smoothForDisplay(samplesOf(), 30);
    // Сглаженная выборка генерируется заново и не несёт исходных step-номеров.
    expect(smooth.every((s) => s.step === -1)).toBe(true);
  });
});
