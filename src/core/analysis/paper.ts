import { ToeClass } from '@/core/model';
import type { AnalysisParams, Curve, StepTablet, ToeClassification } from '@/core/model';
import { PAPER_ANALYSIS, PAPER_EFFECTIVE_GRADE_BANDS, PAPER_GRADE_BANDS } from './constants';
import { buildSamples, densityAt, firstCrossing, maxDensity } from './curve';
import type { Sample } from './curve';
import { adjustedSamples } from './flare';

/**
 * Анализ бумаги: IDmin/IDmax, DR, ES, ISO-диапазон, относительная
 * светочувствительность, класс носка и номера классов.
 *
 * Методика — ANSI/ISO 6846:1992, описана в справке (`app/analyze_tab.htm`):
 *  - IDmax — максимальная используемая плотность = `IDmax %` от Dmax (по умолчанию 90 %);
 *  - IDmin — наименьшая полезная плотность в нижней части прямой области;
 *  - DR — разность плотностей IDmin и IDmax по оси y;
 *  - ES — разность логарифмов экспозиции IDmin и IDmax по оси x;
 *  - ISO Range — ES, округлённая до десятых и умноженная на 100;
 *  - относительная светочувствительность — при плотности 0.6 (ISO P).
 *
 * Абсолютная калибровка экспозиции в файлах не хранится, поэтому и ES, и
 * светочувствительность — относительные величины; проверяются их инварианты и
 * монотонность (см. тесты), а не абсолютные значения.
 */

/** Результат анализа одной кривой бумаги. */
export interface PaperCurveAnalysis {
  /** Кривая. */
  curve: Curve;
  /** Минимальная используемая плотность. */
  idMin?: number;
  /** Максимальная используемая плотность. */
  idMax?: number;
  /** Диапазон плотности (DR) по оси y. */
  dr?: number;
  /** Экспозиционная шкала (ES) по оси x. */
  es?: number;
  /** Номер ISO-диапазона (ES, округлённая до 10). */
  isoRange?: number;
  /** Класс бумаги (по таблице ANSI/ISO 6846). */
  grade?: number;
  /** Эффективный номер класса. */
  effectiveGrade?: number;
  /** Класс носка. */
  toe?: ToeClass;
  /** Относительная светочувствительность (ISO paper speed). */
  speed?: number;
  /** Логарифмы экспозиции границ IDmin и IDmax (относительные). */
  idMinLogE?: number;
  idMaxLogE?: number;
}

/** Локальный градиент (производная плотности по logE) в точке logE. */
function localGradient(samples: readonly Sample[], logE: number, h: number): number {
  const a = densityAt(samples, logE - h);
  const b = densityAt(samples, logE + h);
  if (a !== undefined && b !== undefined) return (b - a) / (2 * h);
  const min = samples[0].logE;
  const max = samples[samples.length - 1].logE;
  const x0 = Math.min(Math.max(logE, min), max);
  const x1 = Math.min(max, x0 + h);
  const x2 = Math.max(min, x0 - h);
  const d0 = densityAt(samples, x0) ?? 0;
  const d1 = densityAt(samples, x1) ?? d0;
  const d2 = densityAt(samples, x2) ?? d0;
  if (x1 > x0) return (d1 - d0) / (x1 - x0);
  if (x0 > x2) return (d0 - d2) / (x0 - x2);
  return 0;
}

/** Наибольший локальный градиент выборки и соответствующая точка logE. */
function maxGradient(samples: readonly Sample[]): { gradient: number; logE: number } {
  let best = { gradient: 0, logE: samples[0]?.logE ?? 0 };
  const h = 0.05;
  for (const s of samples) {
    const g = localGradient(samples, s.logE, h);
    if (g > best.gradient) best = { gradient: g, logE: s.logE };
  }
  return best;
}

/** IDmax = `percent`% от максимальной плотности. */
export function idMax(samples: readonly Sample[], percent: number): number | undefined {
  if (samples.length === 0) return undefined;
  return (percent / 100) * maxDensity(samples);
}

/**
 * IDmin: наименьшая экспозиция, при которой локальный градиент достигает доли
 * от максимального градиента (низ прямой области). Доля задаётся
 * `PAPER_ANALYSIS` через аргумент `gradientFraction`.
 */
export function idMin(
  samples: readonly Sample[],
  gradientFraction = 0.1,
): { logE: number; density: number } | undefined {
  if (samples.length < 2) return undefined;
  const gMax = maxGradient(samples).gradient;
  if (gMax <= 0) return undefined;
  const threshold = gradientFraction * gMax;
  const h = 0.05;
  const logE = firstCrossing(samples, (x) => localGradient(samples, x, h) >= threshold);
  if (logE === undefined) return undefined;
  return { logE, density: densityAt(samples, logE) ?? 0 };
}

/** Класс бумаги по значению ES (таблица ANSI/ISO 6846:1992). */
export function paperGrade(es: number): number | undefined {
  for (const band of PAPER_GRADE_BANDS) {
    if (es >= band.min && es < band.max) return band.value;
  }
  return undefined;
}

/** Эффективный номер класса по значению ES. */
export function effectiveGradeNumber(es: number): number | undefined {
  for (const band of PAPER_EFFECTIVE_GRADE_BANDS) {
    if (es >= band.min && es < band.max) return band.value;
  }
  return undefined;
}

/** Номер ISO-диапазона: ES, округлённая до десятых, умноженная на 100. */
export function isoRangeNumber(es: number): number {
  return Math.round(es * 10) * 10;
}

/**
 * Класс носка: отношение среднего градиента нижней части полезного диапазона
 * (первые 30 %) к среднему градиенту всего диапазона.
 */
export function toeClass(samples: readonly Sample[], idMinLogE: number, idMaxLogE: number): ToeClass {
  const span = idMaxLogE - idMinLogE;
  if (span <= 0) return ToeClass.Normal;
  const gAvg = localGradient(samples, (idMinLogE + idMaxLogE) / 2, span / 2);
  const gToe = localGradient(samples, idMinLogE + span * 0.15, span * 0.15);
  if (gAvg <= 0) return ToeClass.Normal;
  const ratio = gToe / gAvg;
  if (ratio < 0.75) return ToeClass.Long;
  if (ratio > 1.25) return ToeClass.Short;
  return ToeClass.Normal;
}

/**
 * Относительная светочувствительность (ISO paper speed): выражается через
 * логарифм экспозиции, на котором плотность достигает уровня 0.6.
 * Абсолютная калибровка неизвестна, поэтому выбрана так, чтобы типовые
 * бумаги из образцов давали значение порядка 100.
 */
export function relativeSpeed(samples: readonly Sample[]): number | undefined {
  const target = PAPER_ANALYSIS.speedDensity;
  const logE = firstCrossing(samples, (_l, d) => d >= target);
  if (logE === undefined) return undefined;
  // Чем меньше требуемая экспозиция, тем выше светочувствительность.
  const raw =
    PAPER_ANALYSIS.speedBase * Math.pow(10, PAPER_ANALYSIS.speedCalibrationLogE - logE);
  const rounded = Math.round(raw / PAPER_ANALYSIS.speedRounding) * PAPER_ANALYSIS.speedRounding;
  return Math.max(PAPER_ANALYSIS.speedRounding, rounded);
}

/** Анализирует одну кривую бумаги. */
export function analyzePaperCurve(
  curve: Curve,
  tablet: StepTablet,
  params: AnalysisParams,
): PaperCurveAnalysis {
  // Вуаль и коррекция экспозиции моделируются поверх выборки (spec:
  // curve-analysis / «Flare and exposure adjustment»); сохранённые координаты
  // кривой при этом не меняются.
  const samples = adjustedSamples(buildSamples(curve, tablet), params.flareDensity, params.expAdj);
  const result: PaperCurveAnalysis = { curve };
  if (samples.length < 2) return result;

  const idmaxValue = idMax(samples, params.idminPercent);
  if (idmaxValue === undefined) return result;
  result.idMax = idmaxValue;

  const idMinPoint = idMin(samples);
  if (!idMinPoint) return result;
  result.idMin = idMinPoint.density;
  result.idMinLogE = idMinPoint.logE;

  const idMaxLogE = firstCrossing(samples, (_l, d) => d >= idmaxValue);
  if (idMaxLogE === undefined) return result;
  result.idMaxLogE = idMaxLogE;

  result.dr = result.idMax - result.idMin;
  result.es = result.idMaxLogE - result.idMinLogE;
  result.isoRange = isoRangeNumber(result.es);
  result.grade = paperGrade(result.es);
  result.effectiveGrade = effectiveGradeNumber(result.es);
  result.toe = toeClass(samples, result.idMinLogE, result.idMaxLogE);
  result.speed = relativeSpeed(samples);
  return result;
}

/** Анализ семейства кривых бумаги. */
export function analyzePaper(
  curves: readonly Curve[],
  tablet: StepTablet,
  params: AnalysisParams,
): PaperCurveAnalysis[] {
  return curves.map((c) => analyzePaperCurve(c, tablet, params));
}

/** Классификация носка (утилита отображения). */
export function classifyToe(
  samples: readonly Sample[],
  idMinLogE: number,
  idMaxLogE: number,
): ToeClassification {
  return { toeClass: toeClass(samples, idMinLogE, idMaxLogE) };
}
