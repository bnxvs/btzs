import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AnalysisMethod } from '@/core/model';
import type { AnalysisParams } from '@/core/model';
import { readFilm, readPaper } from '@/core/format';
import {
  analyzeFilm,
  analyzeFilmCurve,
  baseFog,
  buildSamples,
  defaultAnalysisParams,
} from '@/core/analysis';

const APP_DIR = join(process.cwd(), 'app');
const params = defaultAnalysisParams();

function filmFiles(): string[] {
  return readdirSync(APP_DIR).filter((f) => f.includes('.pfc'));
}

function readFilmSample(name: string) {
  return readFilm(new Uint8Array(readFileSync(join(APP_DIR, name))));
}

describe('анализ плёнки: построение выборки', () => {
  it('строит точки в порядке возрастания logE', () => {
    const doc = readFilmSample(filmFiles()[0]);
    const samples = buildSamples(doc.curves[0], doc.stepTablet);
    expect(samples.length).toBe(doc.curves[0].points.length);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].logE).toBeGreaterThanOrEqual(samples[i - 1].logE);
    }
  });

  it('выборка сохраняет соответствие ступень-плотность', () => {
    const doc = readFilmSample(filmFiles()[0]);
    const curve = doc.curves[0];
    const samples = buildSamples(curve, doc.stepTablet);
    for (const p of curve.points) {
      const sample = samples.find((s) => s.step === p.step);
      expect(sample?.density).toBeCloseTo(p.density, 12);
    }
  });
});

describe('анализ плёнки: точка скорости', () => {
  it('определяет точку скорости для всех образцов (Approximate CI)', () => {
    for (const file of filmFiles()) {
      const doc = readFilmSample(file);
      for (const curve of doc.curves) {
        const result = analyzeFilmCurve(curve, doc.stepTablet, params, doc.family.filmIso);
        expect(result.speedPointLogE, `${file} / ${curve.label}`).toBeTypeOf('number');
      }
    }
  });

  it('точка скорости лежит внутри диапазона выборки', () => {
    for (const file of filmFiles()) {
      const doc = readFilmSample(file);
      for (const curve of doc.curves) {
        const samples = buildSamples(curve, doc.stepTablet);
        const result = analyzeFilmCurve(curve, doc.stepTablet, params, doc.family.filmIso);
        if (result.speedPointLogE === undefined) continue;
        expect(result.speedPointLogE).toBeGreaterThanOrEqual(samples[0].logE - 1e-9);
        expect(result.speedPointLogE).toBeLessThanOrEqual(
          samples[samples.length - 1].logE + 1e-9,
        );
      }
    }
  });

  it('метод «0.1 over FB+F» даёт точку не выше предыдущей ступени', () => {
    const doc = readFilmSample(filmFiles()[0]);
    const curve = doc.curves[0];
    const overFbf = analyzeFilmCurve(
      curve,
      doc.stepTablet,
      { ...params, method: AnalysisMethod.OverFbF },
      doc.family.filmIso,
    );
    const samples = buildSamples(curve, doc.stepTablet);
    const threshold = baseFog(samples) + 0.1;
    // Плотность в точке скорости для этого метода должна быть >= FB+F+0.1.
    if (overFbf.speedPointLogE !== undefined) {
      const d = interpolate(samples, overFbf.speedPointLogE);
      expect(d).toBeGreaterThanOrEqual(threshold - 1e-6);
    }
  });

  it('переключение метода меняет точку скорости', () => {
    const doc = readFilmSample(filmFiles()[0]);
    let changed = 0;
    for (const curve of doc.curves) {
      const a = analyzeFilmCurve(curve, doc.stepTablet, params, doc.family.filmIso);
      const b = analyzeFilmCurve(
        curve,
        doc.stepTablet,
        { ...params, method: AnalysisMethod.OverFbF },
        doc.family.filmIso,
      );
      if (a.speedPointLogE !== b.speedPointLogE) changed++;
    }
    expect(changed).toBeGreaterThan(0);
  });
});

describe('анализ плёнки: EFS, G-bar, SBR, N', () => {
  it('вычисляет показатели и они конечны', () => {
    for (const file of filmFiles()) {
      const doc = readFilmSample(file);
      const analysis = analyzeFilm(doc.curves, doc.stepTablet, params, doc.family.filmIso);
      expect(analysis.curves).toHaveLength(doc.curves.length);
      for (const c of analysis.curves) {
        expect(c.gBar, `${file} / ${c.curve.label}`).toBeGreaterThan(0);
        expect(c.sbrLog!).toBeGreaterThan(0);
        expect(c.efs!).toBeGreaterThan(0);
        expect(Number.isFinite(c.n!)).toBe(true);
      }
    }
  });

  it('более высокая номинальная ISO повышает EFS', () => {
    const doc = readFilmSample(filmFiles()[0]);
    const at400 = analyzeFilm(doc.curves, doc.stepTablet, params, 400);
    const at100 = analyzeFilm(doc.curves, doc.stepTablet, params, 100);
    for (let i = 0; i < doc.curves.length; i++) {
      expect(at400.curves[i].efs!).toBeGreaterThan(at100.curves[i].efs!);
    }
  });

  it('G-bar растёт с увеличением времени проявления (по образцам)', () => {
    // Кривые в файле упорядочены по времени проявления; градиент должен расти.
    const doc = readFilmSample('_400_TMax_ID11_23_75.pfc');
    const analysis = analyzeFilm(doc.curves, doc.stepTablet, params, doc.family.filmIso);
    const gs = analysis.curves.map((c) => c.gBar!);
    for (let i = 1; i < gs.length; i++) {
      expect(gs[i]).toBeGreaterThan(gs[i - 1]);
    }
  });

  it('EFS монотонно растёт с временем проявления (по образцам)', () => {
    const doc = readFilmSample('_400_TMax_ID11_23_75.pfc');
    const analysis = analyzeFilm(doc.curves, doc.stepTablet, params, doc.family.filmIso);
    const efs = analysis.curves.map((c) => c.efs!);
    for (let i = 1; i < efs.length; i++) {
      expect(efs[i]).toBeGreaterThan(efs[i - 1]);
    }
  });

  it('N-число уменьшается при увеличении Zone Spread', () => {
    const doc = readFilmSample(filmFiles()[0]);
    const a = analyzeFilm(doc.curves, doc.stepTablet, { ...params, zoneSpread: 2 }, doc.family.filmIso);
    const b = analyzeFilm(doc.curves, doc.stepTablet, { ...params, zoneSpread: 6 }, doc.family.filmIso);
    for (let i = 0; i < doc.curves.length; i++) {
      expect(a.curves[i].n!).toBeGreaterThan(b.curves[i].n!);
    }
  });

  it('переход на персональную точку скорости меняет EFS', () => {
    const doc = readFilmSample(filmFiles()[0]);
    const normal = analyzeFilm(doc.curves, doc.stepTablet, params, doc.family.filmIso);
    const psp: AnalysisParams = {
      ...params,
      usePersonalSpeedPoint: true,
      personalSpeedPoint: 3.0,
    };
    const personal = analyzeFilm(doc.curves, doc.stepTablet, psp, doc.family.filmIso);
    const changed = normal.curves.some((c, i) => c.efs !== personal.curves[i].efs);
    expect(changed).toBe(true);
    for (const c of personal.curves) expect(c.usesPersonalSpeedPoint).toBe(true);
  });

  it('флаг низкого градиента различает слабую и сильную кривые', () => {
    const doc = readFilmSample('_400_TMax_ID11_23_75.pfc');
    const analysis = analyzeFilm(doc.curves, doc.stepTablet, params, doc.family.filmIso);
    // Первая кривая (4 мин) — самая слабая: SBR упирается в границу => продление.
    expect(analysis.curves[0].lowGradient).toBe(true);
    // Последняя кривая (16 мин) — сильная: продление не требуется.
    expect(analysis.curves[analysis.curves.length - 1].lowGradient).toBe(false);
  });
});

function interpolate(samples: ReturnType<typeof buildSamples>, logE: number): number {
  for (let i = 1; i < samples.length; i++) {
    if (logE <= samples[i].logE) {
      const a = samples[i - 1];
      const b = samples[i];
      const t = b.logE === a.logE ? 0 : (logE - a.logE) / (b.logE - a.logE);
      return a.density + t * (b.density - a.density);
    }
  }
  return samples[samples.length - 1].density;
}

void readPaper;
