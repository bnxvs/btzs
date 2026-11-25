import type { Curve, CurvePoint, StepTablet } from '@/core/model';

/**
 * Базовые операции над характеристической кривой.
 *
 * Кривые BTZS хранят плотности в порядке убывания относительно номера ступени:
 * ступень 0 соответствует наибольшей экспозиции, последняя — наименьшей
 * (в справке приложения указано «enter your test density values, starting with
 * the highest density»). Плотность клина (второй столбец данных) растёт с
 * номером ступени и является оптической плотностью ступенчатого клина, то есть
 * логарифм экспозиции, падающей на материал, ей обратно пропорционален.
 *
 * Чтобы получить привычную характеристическую кривую «плотность от logE»,
 * каждая точка переводится в координату `logE = -плотность клина`, после чего
 * выборка сортируется по возрастанию `logE`. Абсолютное смещение logE в файлах
 * не хранится, поэтому все оценки — относительные (это отражено в тестах:
 * проверяются инварианты и монотонность, а не абсолютные значения).
 */

/** Точка кривой в координатах (logE, плотность). */
export interface Sample {
  /** Логарифм экспозиции (относительный). */
  logE: number;
  /** Оптическая плотность. */
  density: number;
  /** Исходный номер ступени клина. */
  step: number;
}

/**
 * Строит выборку (logE, плотность) из кривой и активного клина.
 *
 * @param curve   кривая с точками (step, density)
 * @param tablet  активный ступенчатый клин
 * @returns точки, отсортированные по возрастанию logE
 */
export function buildSamples(curve: Curve, tablet: StepTablet): Sample[] {
  const samples = curve.points.map((p: CurvePoint) => ({
    logE: -tabletDensity(tablet, p.step),
    density: p.density,
    step: p.step,
  }));
  samples.sort((a, b) => a.logE - b.logE);
  return samples;
}

/** Плотность ступени клина; при выходе за диапазон — 0. */
function tabletDensity(tablet: StepTablet, step: number): number {
  return tablet.densities[step] ?? 0;
}

/** Диапазон logE выборки. */
export function logERange(samples: readonly Sample[]): { min: number; max: number } {
  if (samples.length === 0) return { min: 0, max: 0 };
  return { min: samples[0].logE, max: samples[samples.length - 1].logE };
}

/**
 * Плотность в заданной точке logE линейной интерполяцией.
 * Возвращает `undefined` вне диапазона выборки.
 */
export function densityAt(samples: readonly Sample[], logE: number): number | undefined {
  if (samples.length === 0) return undefined;
  if (logE < samples[0].logE || logE > samples[samples.length - 1].logE) return undefined;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (logE <= b.logE) {
      if (b.logE === a.logE) return b.density;
      const t = (logE - a.logE) / (b.logE - a.logE);
      return a.density + t * (b.density - a.density);
    }
  }
  return samples[samples.length - 1].density;
}

/**
 * Локальный градиент (производная плотности по logE) в точке выборки
 * центральной разностью; на краях — односторонней.
 */
export function gradientAt(samples: readonly Sample[], index: number): number {
  const n = samples.length;
  if (n < 2) return 0;
  const i = Math.min(Math.max(index, 0), n - 1);
  if (i === 0) return slope(samples[0], samples[1]);
  if (i === n - 1) return slope(samples[n - 2], samples[n - 1]);
  const left = slope(samples[i - 1], samples[i]);
  const right = slope(samples[i], samples[i + 1]);
  return (left + right) / 2;
}

function slope(a: Sample, b: Sample): number {
  const dx = b.logE - a.logE;
  return dx === 0 ? 0 : (b.density - a.density) / dx;
}

/**
 * Средний градиент на интервале [x0, x1]. Значения берутся интерполяцией;
 * если граница выходит за диапазон выборки, используется ближайшее значение.
 */
export function averageGradient(samples: readonly Sample[], x0: number, x1: number): number {
  if (x1 === x0) return 0;
  const d0 = clampDensity(samples, x0);
  const d1 = clampDensity(samples, x1);
  return (d1 - d0) / (x1 - x0);
}

function clampDensity(samples: readonly Sample[], logE: number): number {
  if (samples.length === 0) return 0;
  const { min, max } = logERange(samples);
  const clamped = Math.min(Math.max(logE, min), max);
  return densityAt(samples, clamped) ?? 0;
}

/** Минимальная плотность (уровень base+fog) выборки. */
export function baseFog(samples: readonly Sample[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (const s of samples) if (s.density < min) min = s.density;
  return Number.isFinite(min) ? min : 0;
}

/** Максимальная плотность выборки. */
export function maxDensity(samples: readonly Sample[]): number {
  let max = Number.NEGATIVE_INFINITY;
  for (const s of samples) if (s.density > max) max = s.density;
  return Number.isFinite(max) ? max : 0;
}

/**
 * Находит наименьший logE, при котором предикат переходит из false в true
 * (линейная интерполяция между соседними выборками). Предикат вычисляется
 * для каждой точки выборки. Возвращает `undefined`, если перехода нет.
 */
export function firstCrossing(
  samples: readonly Sample[],
  predicate: (logE: number, density: number, index: number) => boolean,
): number | undefined {
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (predicate(s.logE, s.density, i)) {
      if (i === 0) return s.logE;
      // Линейная интерполяция доли интервала, где предикат становится истинным.
      const prev = samples[i - 1];
      const dPrev = predicate(prev.logE, prev.density, i - 1);
      if (dPrev) return prev.logE;
      const dOf = (x: number) => (densityAt(samples, x) ?? s.density);
      let lo = prev.logE;
      let hi = s.logE;
      for (let k = 0; k < 24; k++) {
        const mid = (lo + hi) / 2;
        if (predicate(mid, dOf(mid), i)) hi = mid;
        else lo = mid;
      }
      return hi;
    }
  }
  return undefined;
}
