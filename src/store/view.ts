import { getOptions } from './options';

/**
 * `store/view` — сеансовые параметры отображения графика семейства (spec:
 * program-options / «Display grid, smooth curves and color curves»; app-shell /
 * «Document-type-specific commands»).
 *
 * Отличие от `store/options`: Options задаёт персональные значения по умолчанию
 * для новых документов, а эти переключатели действуют в текущем сеансе (как
 * пункты меню View) и сбрасываются при выходе из программы. Начальные значения
 * берутся из Options при первом обращении.
 *
 * `getViewSettings` возвращает один и тот же объект, пока значения не менялись:
 * это требуется `useSyncExternalStore` (иначе снимок считается новым на каждом
 * рендере и React зацикливается).
 */
/** Шкала оси X графика семейства. */
export type AxisScale = 'logE' | 'lux';

export interface ViewSettings {
  /** Сглаживать кривые. */
  smoothCurves: boolean;
  /** Рисовать кривые цветом. */
  colorCurves: boolean;
  /** Показывать сетку. */
  displayGrid: boolean;
  /**
   * Шкала оси X: относительный logE либо экспозиция Lux/с. Сеансовый
   * переключатель вида (spec: charts / «Exposure scale switch»).
   */
  xScale: AxisScale;
}

let current: ViewSettings | null = null;
let snapshot: ViewSettings | null = null;

const listeners = new Set<() => void>();

function fromOptions(): ViewSettings {
  const display = getOptions().display;
  return {
    smoothCurves: display.smoothCurves,
    colorCurves: display.colorCurves,
    displayGrid: display.displayGrid,
    xScale: 'logE',
  };
}

/** Текущие сеансовые параметры отображения. */
export function getViewSettings(): ViewSettings {
  if (current === null) current = fromOptions();
  if (snapshot === null) snapshot = { ...current };
  return snapshot;
}

/** Изменяет часть сеансовых параметров отображения. */
export function setViewSettings(patch: Partial<ViewSettings>): ViewSettings {
  current = { ...getViewSettings(), ...patch };
  snapshot = { ...current };
  for (const listener of listeners) listener();
  return snapshot;
}

/** Переключает один сеансовый параметр отображения. */
export function toggleViewSetting(key: keyof ViewSettings): ViewSettings {
  return setViewSettings({ [key]: !getViewSettings()[key] });
}

/** Сбрасывает сеансовые параметры к значениям Options (выход из программы, тесты). */
export function resetViewSettings(): void {
  current = null;
  snapshot = null;
  for (const listener of listeners) listener();
}

/** Подписка на изменение сеансовых параметров. Возвращает функцию отписки. */
export function subscribeViewSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
