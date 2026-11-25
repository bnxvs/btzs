import { AnalysisMethod } from '@/core/model';
import type { AnalysisParams } from '@/core/model';
import { FILM_ANALYSIS, LOG10_2 } from './constants';
import {
  averageGradient,
  baseFog,
  buildSamples,
  densityAt,
  firstCrossing,
  logERange,
  maxDensity,
} from './curve';
import type { Sample } from './curve';
import { adjustedSamples } from './flare';
import type { Curve, StepTablet } from '@/core/model';

/**
 * Анализ плёнки: точка скорости, EFS, G-bar, SBR, зоны и N-числа.
 *
 * Методика реализована по справке приложения (`app/analyze_tab.htm`,
 * `app/film_tab.htm`, `app/chart_tab.htm`) и BTZS/Zone System. Абсолютная
 * калибровка экспозиции в файлах не хранится, поэтому результаты анализа —
 * относительные: проверяются инварианты и монотонность (см. тесты).
 */

/**
 * Смещение между относительной координатой `logE` (равной `-плотность клина`)
 * и «абсолютной» шкалой logE приложения. Подобрано так, чтобы значение
 * персональной точки скорости по умолчанию (2.4) соответствовало типовым
 * точкам скорости плёнки из образцов `app/*.pfc`. Число условно.
 */
export const APP_LOG_E_OFFSET = 4.0;

/** Результат анализа одной кривой плёнки. */
export interface FilmCurveAnalysis {
  /** Кривая, к которой относится результат. */
  curve: Curve;
  /** Координата точки скорости (относительный logE) или undefined. */
  speedPointLogE?: number;
  /** Точка скорости (относительный logE), приведённая к шкале приложения. */
  speedPoint?: number;
  /** Эффективная светочувствительность или undefined. */
  efs?: number;
  /** Средний градиент (G-bar). */
  gBar?: number;
  /** Диапазон яркостей сюжета в логарифмических единицах. */
  sbrLog?: number;
  /** Диапазон яркостей сюжета в стопах. */
  sbrStops?: number;
  /** Номер зоны (N-число) или undefined. */
  n?: number;
  /** Признак использования персональной точки скорости. */
  usesPersonalSpeedPoint: boolean;
  /** Низкий градиент — кривая требует продления пунктиром. */
  lowGradient: boolean;
}

/** Результат анализа семейства плёнки. */
export interface FilmAnalysis {
  /** Результаты по каждой кривой. */
  curves: FilmCurveAnalysis[];
  /** Опорная точка скорости, использованная по умолчанию (относительный logE). */
  referenceSpeedPoint?: number;
  /** Кривая, выбранная в качестве эталонной. */
  referenceCurve?: Curve;
}

/**
 * Определяет точку скорости кривой.
 *
 * @param samples  выборка кривой (logE, плотность)
 * @param method   Approximate CI или «0.1 over FB+F»
 * @returns относительный logE точки скорости или undefined
 */
export function speedPointLogE(
  samples: readonly Sample[],
  method: AnalysisMethod,
): number | undefined {
  if (samples.length === 0) return undefined;
  if (method === AnalysisMethod.OverFbF) {
    const threshold = baseFog(samples) + FILM_ANALYSIS.densityOverBaseFog;
    return firstCrossing(samples, (_logE, density) => density >= threshold);
  }
  // Approximate CI: наименьшая экспозиция, где локальный градиент достигает
  // целевого значения. Для хорошо проявленных кривых целевой градиент равен
  // константе 0.3 (адрес 0x46a628); для слабых кривых (максимальный градиент
  // ниже) порог пропорционально снижается, чтобы точка скорости существовала
  // (иначе кривая не имеет прямолинейного участка).
  const gMax = maxLocalGradient(samples);
  if (gMax <= 0) return undefined;
  const threshold = Math.min(FILM_ANALYSIS.approximateCiGradient, gMax / 2);
  return firstCrossing(
    samples,
    (logE, _density, index) => localGradient(samples, logE, index) >= threshold,
  );
}

/** Наибольший локальный градиент по выборке. */
function maxLocalGradient(samples: readonly Sample[]): number {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const g = localGradient(samples, samples[i].logE, i);
    if (g > max) max = g;
  }
  return max;
}

function localGradient(samples: readonly Sample[], logE: number, index: number): number {
  // Градиент в точке: центральная разность по выборке, но через интерполяцию,
  // чтобы бинарный поиск в firstCrossing работал корректно.
  const h = Math.max(0.001, (logERange(samples).max - logERange(samples).min) / 200);
  const a = densityAt(samples, logE - h);
  const b = densityAt(samples, logE + h);
  if (a !== undefined && b !== undefined) return (b - a) / (2 * h);
  // На краю выборки — односторонняя разность.
  if (index === samples.length - 1 && samples.length >= 2) {
    const prev = samples[index - 1];
    const dx = logE - prev.logE;
    return dx === 0 ? 0 : (samples[index].density - prev.density) / dx;
  }
  if (index === 0 && samples.length >= 2) {
    const next = samples[1];
    const dx = next.logE - logE;
    return dx === 0 ? 0 : (next.density - samples[0].density) / dx;
  }
  return 0;
}

/** Приводит персональную точку скорости к относительной координате logE. */
export function personalSpeedPointLogE(psp: number): number {
  return psp - APP_LOG_E_OFFSET;
}

/**
 * Подбирает экспозиционное «окно» и вычисляет G-bar и SBR для кривой.
 *
 * Модель: плёнка должна воспроизвести диапазон плотности негатива, равный
 * значению ES (так же, как в опции «Lock Film DR = ES»). Средний градиент
 * G-bar определяется на окне [SP, SP + SBR], а SBR — это такое число
 * логарифмических единиц яркости сюжета, при котором `G-bar · SBR = ES`.
 * Уравнение самосогласованное и решается итерацией.
 */
function windowAnalysis(
  samples: readonly Sample[],
  speedPoint: number,
  es: number,
): { gBar: number; sbrLog: number; lowGradient: boolean } | undefined {
  if (samples.length < 2 || es <= 0) return undefined;
  const { max } = logERange(samples);
  const available = max - speedPoint;
  if (available <= 0) return undefined;

  let sbrLog = Math.min(es / FILM_ANALYSIS.referenceAverageGradient, available);
  let gBar = 0;
  for (let i = 0; i < 30; i++) {
    gBar = averageGradient(samples, speedPoint, speedPoint + sbrLog);
    if (gBar <= 0) break;
    const next = Math.min(es / gBar, available);
    if (Math.abs(next - sbrLog) < 1e-9) {
      sbrLog = next;
      break;
    }
    sbrLog = next;
  }
  gBar = averageGradient(samples, speedPoint, speedPoint + sbrLog);
  // Кривая продлевается пунктиром, если требуемый SBR превышает доступный
  // диапазон экспозиции (градиент слишком низок для выбранного ES) или
  // градиент вырожденно мал.
  const lowGradient =
    gBar <= 0 || es / gBar > available + 1e-6 || gBar < FILM_ANALYSIS.lowGradientThreshold;
  return { gBar, sbrLog, lowGradient };
}

/**
 * Строит выборку кривой с применением моделируемых вуали и коррекции
 * экспозиции из параметров анализа (spec: curve-analysis / «Flare and exposure
 * adjustment»). Параметры влияют на контуры и результаты, но не меняют
 * сохранённые координаты кривой (`buildSamples` каждый раз строит новую выборку).
 */
function curveSamples(
  curve: Curve,
  tablet: StepTablet,
  params: AnalysisParams,
): readonly Sample[] {
  return adjustedSamples(buildSamples(curve, tablet), params.flareDensity, params.expAdj);
}

/**
 * Анализирует одну кривую плёнки.
 *
 * @param curve    кривая
 * @param tablet   активный клин
 * @param params   параметры анализа
 * @param filmIso  номинальная ISO плёнки
 * @param referenceSpeedPoint опорная точка скорости (если уже определена)
 */
export function analyzeFilmCurve(
  curve: Curve,
  tablet: StepTablet,
  params: AnalysisParams,
  filmIso: number,
  referenceSpeedPoint?: number,
): FilmCurveAnalysis {
  const samples = curveSamples(curve, tablet, params);
  const sp = speedPointLogE(samples, params.method);
  const usesPersonalSpeedPoint = params.usePersonalSpeedPoint;
  const result: FilmCurveAnalysis = {
    curve,
    usesPersonalSpeedPoint,
    lowGradient: false,
  };
  if (sp === undefined) return result;
  result.speedPointLogE = sp;
  result.speedPoint = sp + APP_LOG_E_OFFSET;

  const window = windowAnalysis(samples, sp, params.es);
  if (window) {
    result.gBar = window.gBar;
    result.sbrLog = window.sbrLog;
    result.sbrStops = window.sbrLog / LOG10_2;
    result.n = (result.sbrStops - params.zoneSpread) / 2;
    result.lowGradient = window.lowGradient;
  }

  const ref = usesPersonalSpeedPoint ? personalSpeedPointLogE(params.personalSpeedPoint) : referenceSpeedPoint;
  if (ref !== undefined && Number.isFinite(filmIso) && filmIso > 0) {
    // Скорость обратно пропорциональна экспозиции: EFS = ISO · 10^(SP_ref − SP).
    result.efs = filmIso * Math.pow(10, ref - sp);
  }
  return result;
}

/**
 * Анализирует семейство кривых плёнки: определяет опорную (номинальную) точку
 * скорости по кривой с градиентом, близким к опорному, затем считает EFS
 * каждой кривой.
 *
 * Опорная точка — это ориентир, «привязанный» к измеренному семейству: она
 * вычисляется по исходным выборкам, без смоделированной вуали и коррекции
 * экспозиции. Поэтому смоделированные эффекты сдвигают кривые относительно
 * неподвижного ориентира, и EFS пересчитывается — так же, как опорная
 * персональная точка скорости (PSP) задаёт постоянную величину
 * (spec: curve-analysis / «Flare and exposure adjustment»).
 */
export function analyzeFilm(
  curves: readonly Curve[],
  tablet: StepTablet,
  params: AnalysisParams,
  filmIso: number,
): FilmAnalysis {
  // Предварительный проход по исходным выборкам: выбор эталонной кривой по
  // G-bar и её точка скорости. Вуаль и Exp. Adj. сюда намеренно не входят —
  // опорная точка не должна «уезжать» вместе с моделируемым сдвигом кривых,
  // иначе коррекция экспозиции взаимно сокращалась бы и не влияла на EFS.
  const prelim = curves.map((curve) => {
    const samples = buildSamples(curve, tablet);
    const sp = speedPointLogE(samples, params.method);
    const window = sp === undefined ? undefined : windowAnalysis(samples, sp, params.es);
    return { curve, sp, gBar: window?.gBar };
  });

  let referenceCurve: Curve | undefined;
  let referenceSpeedPoint: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const p of prelim) {
    if (p.gBar === undefined || p.sp === undefined) continue;
    const distance = Math.abs(p.gBar - FILM_ANALYSIS.referenceAverageGradient);
    if (distance < bestDistance) {
      bestDistance = distance;
      referenceCurve = p.curve;
      referenceSpeedPoint = p.sp;
    }
  }

  const results = curves.map(
    (c) => analyzeFilmCurve(c, tablet, params, filmIso, referenceSpeedPoint),
  );
  return { curves: results, referenceSpeedPoint, referenceCurve };
}

/**
 * Зоны сюжета/плотности негатива считает `filmGraphZones` (`family.ts`): для
 * каждой зоны 2..8 он возвращает интервал относительной экспозиции (`x0`, `x1`)
 * и диапазон плотности с медианой (`low`, `high`, `median`). Отдельные функции
 * «зон сюжета» и «зон плотности негатива» не нужны — это одни и те же зоны,
 * показанные с двух сторон (см. spec: curve-analysis / «Zone analysis»).
 */

/**
 * Продлевает кривую при низком градиенте: возвращает дополнительные точки,
 * продолжающие контур от последней выборки с терминальным градиентом.
 *
 * @param samples  выборка
 * @param targetDensity плотность, до которой нужно продлить
 */
export function extendForLowGradient(
  samples: readonly Sample[],
  targetDensity: number,
): { logE: number; density: number; extended: true }[] {
  if (samples.length < 2) return [];
  const last = samples[samples.length - 1];
  const prev = samples[samples.length - 2];
  const gradient = (last.density - prev.density) / (last.logE - prev.logE);
  if (!Number.isFinite(gradient) || gradient <= 0) return [];
  if (last.density >= targetDensity) return [];
  const out: { logE: number; density: number; extended: true }[] = [];
  const steps = 10;
  const span = (targetDensity - last.density) / gradient;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    out.push({ logE: last.logE + span * t, density: last.density + (targetDensity - last.density) * t, extended: true });
  }
  return out;
}

/** Максимальная плотность кривой с учётом flare — вспомогательная величина. */
export function filmMaxDensity(curve: Curve, tablet: StepTablet): number {
  return maxDensity(buildSamples(curve, tablet));
}

export { baseFog };
