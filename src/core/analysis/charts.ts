import { FilmChart, PaperChart, parseDevTime } from '@/core/model';
import { isoRangeNumber } from './paper';
import type { FilmAnalysis } from './film';
import type { PaperCurveAnalysis } from './paper';

/**
 * Серии данных для вкладки графиков (spec: charts).
 *
 * Чистые функции: принимают результат анализа и возвращают точки для
 * построения графика. Оси и подписи — забота UI; здесь только числа, чтобы
 * корректность осей и точек проверялась юнит-тестами без графической среды.
 *
 * Плёночные графики (6 шт.):
 *  - группа «Dev. Time» — по оси x время проявления (минуты), по оси y
 *    диапазон яркостей сюжета (SBR, в стопах), средний градиент (G-bar) или
 *    N-число; кривые с некорректным временем проявления не показываются
 *    (spec: film-documents / «Некорректный формат времени»);
 *  - группа «EFS» — по оси x эффективная светочувствительность (EFS), по оси
 *    y те же три величины (влияние вариаций проявления на светочувствительность).
 *
 * Бумажные графики (2 шт.):
 *  - «ISO Range Chart» — номер ISO-диапазона (ES, округлённая до 10) по оси y;
 *  - «Paper Grade Chart» — ES по правой оси y, номер класса/фильтра — по левой
 *    (spec: charts / «Расчёт Paper Grade Chart»).
 */

/** Точка графика (общие поля). */
export interface ChartPoint {
  /** Координата по оси x. */
  x: number;
  /** Координата по оси y. */
  y: number;
  /** Метка кривой (время проявления, номер фильтра и т. п.). */
  label: string;
  /** Индекс кривой в семействе (порядок соединения точек). */
  index: number;
  /** Точка не соединяется линией с остальными («Don't connect in chart»). */
  dontConnect: boolean;
}

/** Точка плёночного графика. */
export interface FilmChartPoint extends ChartPoint {
  /** EFS рассчитана по персональной точке скорости (нужно для легенды). */
  usesPersonalSpeedPoint: boolean;
}

/** Точка бумажного графика. */
export interface PaperChartPoint extends ChartPoint {
  /** Экспозиционная шкала ES (правая ось «Paper Grade Chart»). */
  es: number;
  /** Номер ISO-диапазона (ES, округлённая до 10). */
  isoRange: number;
  /** Номер класса бумаги по ES (левая ось «Paper Grade Chart»). */
  grade?: number;
}

/** Метрика плёночного графика по оси y. */
export type FilmChartMetric = 'sbr' | 'g' | 'n';

/** График относится к группе Dev. Time (ось x — время проявления). */
export function isDevTimeChart(chart: FilmChart): boolean {
  return (
    chart === FilmChart.DevTimeSbr ||
    chart === FilmChart.DevTimeG ||
    chart === FilmChart.DevTimeN
  );
}

/** Метрика плёночного графика. */
export function filmChartMetric(chart: FilmChart): FilmChartMetric {
  if (chart === FilmChart.DevTimeSbr || chart === FilmChart.EfsSbr) return 'sbr';
  if (chart === FilmChart.DevTimeG || chart === FilmChart.EfsG) return 'g';
  return 'n';
}

/** Значение метрики кривой плёнки (в единицах соответствующей оси). */
function filmMetric(
  metric: FilmChartMetric,
  curve: FilmAnalysis['curves'][number],
): number | undefined {
  switch (metric) {
    case 'sbr':
      // SBR выражается в стопах (spec: «group of subject range in stops»).
      return curve.sbrStops;
    case 'g':
      return curve.gBar;
    case 'n':
      return curve.n;
  }
}

/**
 * Строит серию точек плёночного графика.
 *
 * Точки идут в порядке кривых семейства (порядок соединения кривой). Кривая
 * пропускается, если её метрика не определена, а для Dev. Time — также если
 * метку нельзя разобрать как время проявления.
 */
export function filmChartSeries(
  chart: FilmChart,
  analysis: FilmAnalysis,
): FilmChartPoint[] {
  const metric = filmChartMetric(chart);
  const devTime = isDevTimeChart(chart);
  const points: FilmChartPoint[] = [];
  analysis.curves.forEach((curve, index) => {
    const y = filmMetric(metric, curve);
    if (y === undefined) return;
    let x: number;
    if (devTime) {
      const minutes = parseDevTime(curve.curve.label);
      if (minutes === null) return;
      x = minutes;
    } else {
      if (curve.efs === undefined) return;
      x = curve.efs;
    }
    points.push({
      x,
      y,
      label: curve.curve.label,
      index,
      dontConnect: curve.curve.dontConnectInChart,
      usesPersonalSpeedPoint: curve.usesPersonalSpeedPoint,
    });
  });
  return points;
}

/**
 * Строит серию точек бумажного графика.
 *
 * По оси x — позиция кривой в семействе (категория: номер фильтра/класса
 * берётся из метки); по оси y — номер ISO-диапазона либо ES. Кривые без ES
 * пропускаются.
 */
export function paperChartSeries(
  chart: PaperChart,
  analysis: readonly PaperCurveAnalysis[],
): PaperChartPoint[] {
  const points: PaperChartPoint[] = [];
  analysis.forEach((curve, index) => {
    if (curve.es === undefined) return;
    const isoRange = curve.isoRange ?? isoRangeNumber(curve.es);
    points.push({
      x: index,
      y: chart === PaperChart.IsoRange ? isoRange : curve.es,
      label: curve.curve.label,
      index,
      dontConnect: curve.curve.dontConnectInChart,
      es: curve.es,
      isoRange,
      grade: curve.grade,
    });
  });
  return points;
}

/** Индекс точки, ближайшей к курсору в координатах данных (для инструмента Track). */
export function nearestChartPoint(
  points: readonly ChartPoint[],
  x: number,
  y: number,
): ChartPoint | undefined {
  let best: ChartPoint | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const dx = point.x - x;
    const dy = point.y - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }
  return best;
}

/**
 * Значение времени проявления для положения курсора (инструмент Track).
 *
 * Курсор задаётся в координатах данных; возвращается время проявления
 * ближайшей точки серии Dev. Time (или `undefined`, если серия пуста).
 */
export function trackDevTime(
  points: readonly FilmChartPoint[],
  x: number,
  y: number,
): number | undefined {
  return nearestChartPoint(points, x, y)?.x;
}
