/**
 * Геометрия графиков вкладки Charts: перевод координат данных в пиксели
 * виртуальной области отрисовки и обратно.
 *
 * Вынесено из компонента, чтобы корректность осей и положение точек
 * проверялись юнит-тестами без графической среды (jsdom не считает layout).
 */

/** Область отрисовки в пикселях. */
export interface PlotBox {
  /** Ширина области данных (без подписей осей). */
  width: number;
  /** Высота области данных. */
  height: number;
  /** Отступ области данных от края графика. */
  padding: number;
}

/** Границы данных по осям. */
export interface DataScale {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Область отрисовки по умолчанию (совпадает с `viewBox` графика). */
export const DEFAULT_PLOT: PlotBox = { width: 520, height: 360, padding: 44 };

/** Размер `viewBox` графика (координаты SVG совпадают с пикселями области). */
export const PLOT_VIEW = { width: 640, height: 460 } as const;

/** log10(2): шаг одной ступени (стопа) по оси логарифма экспозиции. */
export const LOG10_2 = Math.log10(2);

/** Деление оси экспозиции: позиция в координатах logE и само значение экспозиции. */
export interface LuxTick {
  /** Позиция на оси в координатах относительного logE. */
  x: number;
  /** Значение экспозиции `E = 10^logE`. */
  value: number;
}

/**
 * Деления оси экспозиции для «сенситометрического» вида (spec: charts /
 * «Exposure scale switch»).
 *
 * Ось остаётся логарифмической (координата точки — относительный logE), но
 * подписывается значениями экспозиции `E = 10^logE`, а деления идут через
 * каждую ступень (×2, то есть `log10 2`), как на старых сенситометрических
 * бланках. Ряд начинается от ближайшей круглой декады (`10^a`) внутри
 * диапазона, поэтому подписи остаются удобочитаемыми (0,01·2^n).
 */
export function luxTicks(scale: DataScale): LuxTick[] {
  const decade = Math.ceil(scale.xMin - 1e-9);
  const ticks: LuxTick[] = [];
  for (let k = 0; ; k++) {
    const x = decade + k * LOG10_2;
    if (x > scale.xMax + 1e-9) break;
    ticks.push({ x, value: Math.pow(10, x) });
  }
  return ticks;
}

/** Настройка границ оси. */
export interface ScaleOptions {
  /**
   * Не опускать нижнюю границу оси Y ниже нуля. Нужно для оси плотности
   * (spec: charts / «Family curve graph»): плотность неотрицательна, а базовая
   * линия `D=0` — нижняя граница, поэтому запас снизу давал отрицательные
   * подписи («-0,11»). Верхний запас при этом сохраняется.
   */
  clampYMinZero?: boolean;
}

/**
 * Границы данных по набору координат.
 *
 * Если значений нет — диапазон `[-1, 1]`; если все значения равны — диапазон
 * расширяется на ±1, чтобы точки не схлопывались в линию или точку на краю.
 * При `clampYMinZero` нижняя граница Y не уходит ниже нуля.
 */
export function seriesScale(
  xs: readonly number[],
  ys: readonly number[],
  options: ScaleOptions = {},
): DataScale {
  const x = range(xs);
  const y = range(ys, options.clampYMinZero ?? false);
  return { xMin: x.min, xMax: x.max, yMin: y.min, yMax: y.max };
}

function range(values: readonly number[], clampMinZero = false): { min: number; max: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  let min: number;
  let max: number;
  if (finite.length === 0) {
    min = -1;
    max = 1;
  } else {
    min = Math.min(...finite);
    max = Math.max(...finite);
    if (min === max) {
      min -= 1;
      max += 1;
    }
  }
  // Небольшой запас по краям, чтобы крайние точки не липли к рамке.
  const margin = (max - min) * 0.05;
  let lo = min - margin;
  // Плотность не бывает отрицательной: не заводим ось ниже нуля.
  if (clampMinZero && min >= 0 && lo < 0) lo = 0;
  return { min: lo, max: max + margin };
}

/** Координата x данных → пиксель. */
export function toPixelX(x: number, scale: DataScale, box: PlotBox = DEFAULT_PLOT): number {
  const span = scale.xMax - scale.xMin || 1;
  return box.padding + ((x - scale.xMin) / span) * box.width;
}

/** Координата y данных → пиксель (ось направлена вверх). */
export function toPixelY(y: number, scale: DataScale, box: PlotBox = DEFAULT_PLOT): number {
  const span = scale.yMax - scale.yMin || 1;
  return box.padding + box.height - ((y - scale.yMin) / span) * box.height;
}

/** Пиксель x → координата данных. */
export function fromPixelX(px: number, scale: DataScale, box: PlotBox = DEFAULT_PLOT): number {
  const span = scale.xMax - scale.xMin || 1;
  return scale.xMin + ((px - box.padding) / box.width) * span;
}

/** Пиксель y → координата данных. */
export function fromPixelY(py: number, scale: DataScale, box: PlotBox = DEFAULT_PLOT): number {
  const span = scale.yMax - scale.yMin || 1;
  return scale.yMin + ((box.padding + box.height - py) / box.height) * span;
}

/** Положение и стиль контрольной точки для отрисовки. */
export interface PixelPoint {
  px: number;
  py: number;
}

/**
 * Разбивает точки серии на отрезки ломаной с учётом флага «Don't connect in
 * chart»: помеченная точка стоя́ит отдельно и не соединяется с соседями
 * (spec: charts / «Chart point connection control»).
 */
export function connectSegments<T extends { dontConnect: boolean }>(
  points: readonly T[],
): T[][] {
  const segments: T[][] = [];
  let current: T[] = [];
  for (const point of points) {
    if (point.dontConnect) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      segments.push([point]);
    } else {
      current.push(point);
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}
