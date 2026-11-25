import type { PlotterDocument, StepTablet } from './types';

/**
 * Операции над ступенчатым клином (spec: step-tablet).
 *
 * Здесь только чистая логика уровня домена: проверка пригодности клина,
 * копирование, извлечение активного клина документа и импорт клина из другого
 * документа Plotter. Конструирование документа из файла устаревшего формата —
 * задача `core/format/legacy-format` (там известен сам формат), хранение двух
 * «сохранённых по умолчанию» клиньев — уровень `store`.
 *
 * Модуль намеренно не зависит от `core/format` (иначе возник бы цикл
 * `format → model → format`).
 */

/** Число сохранённых клиньев по умолчанию (Step Tablet #1 и #2). */
export const STEP_TABLET_SLOTS = 2;

/** Копия клина (глубокая). */
export function cloneStepTablet(tablet: StepTablet): StepTablet {
  return { densities: [...tablet.densities] };
}

/**
 * Клин пригоден: непустой и все ступени — конечные числа.
 *
 * Используется при импорте клина из файла/документа: непригодный клин
 * отклоняется с сообщением об ошибке (spec: step-tablet / «Импорт клина из
 * файла»).
 */
export function isValidStepTablet(tablet: StepTablet | undefined): tablet is StepTablet {
  if (!tablet || !Array.isArray(tablet.densities) || tablet.densities.length === 0) return false;
  return tablet.densities.every((d) => Number.isFinite(d));
}

/** Активный клин документа (плёнки/бумаги); у Matcher клина нет. */
export function documentStepTablet(doc: PlotterDocument): StepTablet | null {
  return doc.kind === 'matcher' ? null : doc.stepTablet;
}

/** Результат импорта клина из документа Plotter. */
export type ImportStepTabletResult =
  | { ok: true; tablet: StepTablet }
  | { ok: false; error: 'no-tablet' | 'matcher' };

/**
 * Извлекает ступенчатый клин из другого файла Plotter (`.pfc`/`.ppc`).
 *
 * Spec (step-tablet / «Step tablet import from another Plotter file»): клин
 * извлекается; если файл не содержит клина — сообщается об этом.
 */
export function importStepTabletFromDocument(source: PlotterDocument): ImportStepTabletResult {
  if (source.kind === 'matcher') return { ok: false, error: 'matcher' };
  if (!isValidStepTablet(source.stepTablet)) return { ok: false, error: 'no-tablet' };
  return { ok: true, tablet: cloneStepTablet(source.stepTablet) };
}
