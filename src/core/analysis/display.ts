import { densityAt } from './curve';
import type { Sample } from './curve';

/**
 * Сглаживание кривых — только для отображения.
 *
 * Функции этого модуля возвращают НОВЫЕ точки для отрисовки и никогда не
 * изменяют переданные выборки или сохранённые координаты кривой. Тест
 * проверяет, что исходные данные побитово не изменяются, а число точек
 * результата соответствует запрошенной плотности.
 */

/**
 * Сглаживает выборку для отображения, генерируя `resolution` равномерно
 * распределённых по logE точек с интерполяцией плотности. Возвращает новую
 * выборку; входные данные не меняются.
 */
export function smoothForDisplay(samples: readonly Sample[], resolution = 100): Sample[] {
  if (samples.length < 2) return samples.map((s) => ({ ...s }));
  const min = samples[0].logE;
  const max = samples[samples.length - 1].logE;
  const out: Sample[] = [];
  for (let i = 0; i < resolution; i++) {
    const logE = min + ((max - min) * i) / (resolution - 1);
    out.push({ logE, density: densityAt(samples, logE) ?? 0, step: -1 });
  }
  return out;
}
