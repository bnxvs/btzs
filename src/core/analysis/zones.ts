import { densityAt } from './curve';
import type { Sample } from './curve';

/**
 * Зоны печати и медианная плотность.
 *
 * Зоны печати 2..8 определяются контуром выбранной бумажной кривой: границы
 * зон плотности негатива (вычисленные по плёночной кривой) проецируются на
 * бумажную кривую, а затем переносятся в зоны печати. Здесь границы зон
 * задаются долями полезного диапазона плотности бумаги и вычисляются по
 * фактическому контуру (интерполяцией), поэтому при наведении на столбец
 * доступны границы плотностей и медианная плотность зоны.
 */

/** Медиана массива значений (для пустого — 0). */
export function medianDensity(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Границы одной зоны печати. */
export interface PrintZoneBounds {
  /** Номер зоны (2..8). */
  zone: number;
  /** Нижняя граница плотности. */
  low: number;
  /** Верхняя граница плотности. */
  high: number;
  /** Медианная плотность зоны. */
  median: number;
}

/**
 * Вычисляет границы зон печати по бумажной кривой.
 *
 * @param samples     выборка бумажной кривой (logE, плотность)
 * @param idMinLogE   относительный logE границы IDmin
 * @param idMaxLogE   относительный logE границы IDmax
 * @param zoneCount   число зон (по умолчанию 7 — зоны 2..8)
 */
export function printZoneBounds(
  samples: readonly Sample[],
  idMinLogE: number,
  idMaxLogE: number,
  zoneCount = 7,
): PrintZoneBounds[] {
  const out: PrintZoneBounds[] = [];
  const span = idMaxLogE - idMinLogE;
  if (span <= 0) return out;
  for (let z = 0; z < zoneCount; z++) {
    const x0 = idMinLogE + (span * z) / zoneCount;
    const x1 = idMinLogE + (span * (z + 1)) / zoneCount;
    const d0 = densityAt(samples, x0) ?? 0;
    const d1 = densityAt(samples, x1) ?? d0;
    const mid = densityAt(samples, (x0 + x1) / 2) ?? (d0 + d1) / 2;
    out.push({
      zone: 2 + z,
      low: Math.min(d0, d1),
      high: Math.max(d0, d1),
      median: mid,
    });
  }
  return out;
}

/** Вспомогательное: медианная плотность набора зон. */
export function zonesMedian(zones: readonly PrintZoneBounds[]): number {
  return medianDensity(zones.map((z) => z.median));
}
