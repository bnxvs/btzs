import type { AnalysisParams, Curve, StepTablet } from '@/core/model';
import { buildSamples, densityAt } from './curve';
import type { Sample } from './curve';
import { adjustedSamples } from './flare';
import { smoothForDisplay } from './display';
import { printZoneBounds } from './zones';

/**
 * Данные графика семейства характеристических кривых (spec: charts /
 * «Family curve graph»).
 *
 * Чистые функции: по кривым семейства и активному клину строят точки
 * (logE, плотность) для отрисовки, общий диапазон осей и — при наличии анализа
 * — зоны сюжета/плотности негатива (плёнка) либо зоны печати (бумага). Сами
 * пиксели считает UI (`ui/charts/chart-scale`), поэтому корректность данных
 * проверяется юнит-тестами без графической среды.
 *
 * Кривая на графике строится по моделируемым (flare/Exp. Adj.) выборкам, как и
 * анализ: при `smooth` линия интерполируется `smoothForDisplay`, но отмеченные
 * точки остаются в измеренных положениях.
 */

/** Точка серии на графике. */
export interface PlotPoint {
  /** Логарифм экспозиции (относительный). */
  x: number;
  /** Плотность. */
  y: number;
  /** Подпись точки (например, время проявления). */
  label?: string;
}

/** Одна кривая графика семейства. */
export interface FamilySeries {
  /** Порядковый номер кривой в семействе. */
  index: number;
  /** Отображаемое имя кривой. */
  label: string;
  /** Точки линии (измеренные либо сглаженные). */
  points: PlotPoint[];
  /** Измеренные точки (маркеры), включая номера ступеней. */
  markers: PlotPoint[];
  /** Кривая не соединяется линией («Don't connect in chart»). */
  dontConnect: boolean;
}

/** Зона на графике: полоса вдоль нижней оси и диапазон плотности справа. */
export interface GraphZone {
  /** Номер зоны (2..8). */
  zone: number;
  /** Левая граница зоны по logE. */
  x0: number;
  /** Правая граница зоны по logE. */
  x1: number;
  /** Нижняя граница плотности зоны. */
  low: number;
  /** Верхняя граница плотности зоны. */
  high: number;
  /** Медианная плотность зоны. */
  median: number;
}

/** Наложение зон на график семейства. */
export interface GraphZones {
  /** Зоны (полосы снизу и диапазоны плотности справа). */
  zones: GraphZone[];
}

/** Данные графика семейства. */
export interface FamilyPlot {
  /** Серии (по одной на кривую). */
  series: FamilySeries[];
  /** Зоны (если применимы к виду документа). */
  zones: GraphZones;
  /** Есть ли данные для отрисовки. */
  hasData: boolean;
}

/** Число зон на графике (зоны 2..8). */
export const FAMILY_ZONE_COUNT = 7;

/** Кэшированное построение выборки кривой с учётом flare/Exp. Adj. */
function curveSamples(curve: Curve, tablet: StepTablet, params: AnalysisParams): Sample[] {
  return [...adjustedSamples(buildSamples(curve, tablet), params.flareDensity, params.expAdj)];
}

/** Строит данные графика семейства по кривым документа. */
export function buildFamilyPlot(
  curves: readonly Curve[],
  tablet: StepTablet,
  params: AnalysisParams,
  options: { smooth?: boolean; resolution?: number } = {},
): FamilyPlot {
  const smooth = options.smooth ?? false;
  const resolution = options.resolution ?? 100;
  const series: FamilySeries[] = curves.map((curve, index) => {
    const samples = curveSamples(curve, tablet, params);
    const line = smooth ? smoothForDisplay(samples, resolution) : samples;
    return {
      index,
      label: curve.label,
      points: line.map((s) => ({ x: s.logE, y: s.density })),
      markers: samples.map((s) => ({ x: s.logE, y: s.density })),
      dontConnect: curve.dontConnectInChart,
    };
  });
  return {
    series,
    zones: { zones: [] },
    hasData: series.some((s) => s.points.length > 0),
  };
}

/** Зоны сюжета и плотности негатива плёнки по выбранной кривой. */
export function filmGraphZones(
  curve: Curve,
  tablet: StepTablet,
  params: AnalysisParams,
  speedPointLogE: number | undefined,
  sbrLog: number | undefined,
): GraphZones {
  if (speedPointLogE === undefined || sbrLog === undefined || sbrLog <= 0) {
    return { zones: [] };
  }
  const samples = curveSamples(curve, tablet, params);
  // Диапазон яркостей сюжета делится на семь равных зон 2..8.
  const step = sbrLog / FAMILY_ZONE_COUNT;
  const zones: GraphZone[] = [];
  for (let i = 0; i < FAMILY_ZONE_COUNT; i++) {
    const x0 = speedPointLogE + step * i;
    const x1 = speedPointLogE + step * (i + 1);
    const d0 = densityAt(samples, x0) ?? 0;
    const d1 = densityAt(samples, x1) ?? d0;
    const median = densityAt(samples, (x0 + x1) / 2) ?? (d0 + d1) / 2;
    zones.push({
      zone: 2 + i,
      x0,
      x1,
      low: Math.min(d0, d1),
      high: Math.max(d0, d1),
      median,
    });
  }
  return { zones };
}

/** Зоны печати бумаги по выбранной кривой. */
export function paperGraphZones(
  curve: Curve,
  tablet: StepTablet,
  params: AnalysisParams,
  idMinLogE: number | undefined,
  idMaxLogE: number | undefined,
): GraphZones {
  if (idMinLogE === undefined || idMaxLogE === undefined || idMaxLogE <= idMinLogE) {
    return { zones: [] };
  }
  const samples = curveSamples(curve, tablet, params);
  const span = idMaxLogE - idMinLogE;
  const bounds = printZoneBounds(samples, idMinLogE, idMaxLogE, FAMILY_ZONE_COUNT);
  const zones: GraphZone[] = bounds.map((b, i) => ({
    zone: b.zone,
    x0: idMinLogE + (span * i) / FAMILY_ZONE_COUNT,
    x1: idMinLogE + (span * (i + 1)) / FAMILY_ZONE_COUNT,
    low: b.low,
    high: b.high,
    median: b.median,
  }));
  return { zones };
}
