import { LOG10_2 } from './constants';
import { baseFog } from './curve';
import type { Sample } from './curve';

/**
 * Моделирование вуали (flare) и коррекции экспозиции (Exp. Adj.).
 *
 * Обе операции пересчитывают контур кривой для отображения и анализа, но
 * SHALL NOT менять сохранённые координатные значения (см. `display.ts`).
 *
 * Модель вуали: вуаль добавляет паразитную экспозицию, которая поднимает
 * плотности в тенях (уровень base+fog) и почти исчезает в области больших
 * плотностей. Приближённая модель:
 *
 *     D'(x) = D(x) + FD · 10^(−(D(x) − Dmin)),  FD >= 0
 *
 * При FD = 0 кривая не меняется; рост FD монотонно увеличивает плотности
 * (насыщаясь к высоким плотностям), что и проверяется тестом монотонности.
 *
 * Модель коррекции экспозиции: сдвиг кривой вдоль оси logE на
 * `stops · log10(2)`. Положительное значение — переэкспонирование: при той же
 * экспозиции сюжета плотность выше, что соответствует сдвигу кривой влево.
 */

/** Добавляет вуаль заданной плотности к выборке (возвращает новую выборку). */
export function applyFlare(samples: readonly Sample[], flareDensity: number): Sample[] {
  if (!(flareDensity > 0)) return samples.map((s) => ({ ...s }));
  const dmin = baseFog(samples);
  return samples.map((s) => ({
    ...s,
    density: s.density + flareDensity * Math.pow(10, -(s.density - dmin)),
  }));
}

/** Сдвигает выборку по logE на указанное число стопов экспозиции. */
export function applyExposureAdjustment(samples: readonly Sample[], stops: number): Sample[] {
  const shift = stops * LOG10_2;
  return samples.map((s) => ({ ...s, logE: s.logE - shift }));
}

/** Применяет вуаль и коррекцию экспозиции к выборке в указанном порядке. */
export function applyAdjustments(
  samples: readonly Sample[],
  flareDensity: number,
  expAdj: number,
): Sample[] {
  return applyExposureAdjustment(applyFlare(samples, flareDensity), expAdj);
}

/**
 * Применяет к выборке моделируемые вуаль и коррекцию экспозиции из параметров
 * анализа. При нулевых значениях исходная выборка возвращается без копий.
 *
 * Вызывается как плёночным, так и бумажным анализом: изменение этих
 * параметров немедленно меняет контуры и результаты (spec: charts /
 * «Изменение параметров графика»).
 */
export function adjustedSamples(
  samples: readonly Sample[],
  flareDensity: number,
  expAdj: number,
): readonly Sample[] {
  if (!(flareDensity > 0) && expAdj === 0) return samples;
  return applyAdjustments(samples, flareDensity, expAdj);
}
